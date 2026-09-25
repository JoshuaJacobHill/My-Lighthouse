import { describe, expect, it } from 'vitest'
import webpush from 'web-push'

/**
 * The encoding bug that cost three weeks of silent notifications.
 *
 * These test `web-push`'s own acceptance rather than our wrapper, because the
 * wrapper's whole job is to hand it something it will accept. Generating a
 * real key pair keeps it honest: if the library's rules change, this fails
 * rather than passing against a fixture that encodes yesterday's assumption.
 */
function decode(key: string): Uint8Array | null {
  try {
    const standard = key.replace(/-/g, '+').replace(/_/g, '/')
    const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function encode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function normaliseKey(raw: string, expectedBytes: number): string {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const bytes = decode(cleaned)
  if (bytes && bytes.length === expectedBytes + 1 && bytes[0] === 0) {
    return encode(bytes.subarray(1))
  }
  return cleaned
}

describe('VAPID key normalising', () => {
  const pair = webpush.generateVAPIDKeys()

  it('accepts a correctly generated pair, unchanged', () => {
    expect(() =>
      webpush.setVapidDetails('mailto:josh@lighthousecare.org.au', pair.publicKey, pair.privateKey),
    ).not.toThrow()
  })

  it('rejects standard base64 — the actual production fault', () => {
    // What a key looks like copied out of a tool that emits standard base64.
    const standard = pair.privateKey.replace(/-/g, '+').replace(/_/g, '/') + '='
    expect(() =>
      webpush.setVapidDetails('mailto:josh@lighthousecare.org.au', pair.publicKey, standard),
    ).toThrow(/Base 64/)
  })

  it('normalising makes that same key acceptable again', () => {
    const standard = pair.privateKey.replace(/-/g, '+').replace(/_/g, '/') + '='
    expect(() =>
      webpush.setVapidDetails(
        'mailto:josh@lighthousecare.org.au',
        normaliseKey(pair.publicKey, 65),
        normaliseKey(standard, 32),
      ),
    ).not.toThrow()
  })

  it('survives the trailing newline an environment variable picks up', () => {
    expect(normaliseKey(`${pair.privateKey}\n`, 32)).toBe(pair.privateKey)
    expect(normaliseKey(`  ${pair.privateKey}  `, 32)).toBe(pair.privateKey)
  })

  it('leaves a key that is already right exactly as it is', () => {
    expect(normaliseKey(pair.privateKey, 32)).toBe(pair.privateKey)
    expect(normaliseKey(pair.publicKey, 65)).toBe(pair.publicKey)
  })

  it('decodes without Buffer, which is not present in every runtime', () => {
    // Reaching for Buffer turned a 33-byte key into a reported "0 bytes" —
    // a decoder failure dressed up as a key problem.
    expect(decode(pair.privateKey)!.length).toBe(32)
    // A key with characters base64 cannot contain returns null rather than a
    // misleading byte count — "does not decode" is the honest report.
    expect(decode('not valid base64!!')).toBeNull()
  })

  it('knows the sizes it is checking for', () => {
    expect(decode(normaliseKey(pair.privateKey, 32))!.length).toBe(32)
    expect(decode(normaliseKey(pair.publicKey, 65))!.length).toBe(65)
  })

  it('drops the leading zero byte a signed-integer encoding adds', () => {
    // What production actually had: 33 bytes, because the scalar's high bit
    // was set and the generator encoded it as a signed integer.
    const raw = decode(pair.privateKey)!
    const withZero = new Uint8Array(raw.length + 1)
    withZero.set(raw, 1)
    const padded = encode(withZero)
    expect(decode(padded)!.length).toBe(33)

    const fixed = normaliseKey(padded, 32)
    expect(fixed).toBe(pair.privateKey)
    expect(() =>
      webpush.setVapidDetails('mailto:josh@lighthousecare.org.au', pair.publicKey, fixed),
    ).not.toThrow()
  })

  it('does not strip a leading zero that is part of a correct-length key', () => {
    // Only the one-byte-too-long case is an artefact. A key that is already
    // the right size keeps every byte, whatever it starts with.
    const exactly32 = new Uint8Array(32).fill(7)
    exactly32[0] = 0
    const zeroLed = encode(exactly32)
    expect(normaliseKey(zeroLed, 32)).toBe(zeroLed)
  })
})
