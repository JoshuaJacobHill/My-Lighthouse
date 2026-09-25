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
function normaliseKey(raw: string, expectedBytes: number): string {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  try {
    const bytes = Buffer.from(cleaned, 'base64url')
    if (bytes.length === expectedBytes + 1 && bytes[0] === 0) {
      return bytes.subarray(1).toString('base64url')
    }
  } catch {
    // Fall through — the size check reports it.
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

  it('knows the sizes it is checking for', () => {
    expect(Buffer.from(normaliseKey(pair.privateKey, 32), 'base64url').length).toBe(32)
    expect(Buffer.from(normaliseKey(pair.publicKey, 65), 'base64url').length).toBe(65)
  })

  it('drops the leading zero byte a signed-integer encoding adds', () => {
    // What production actually had: 33 bytes, because the scalar's high bit
    // was set and the generator encoded it as a signed integer.
    const raw = Buffer.from(pair.privateKey, 'base64url')
    const padded = Buffer.concat([Buffer.from([0]), raw]).toString('base64url')
    expect(Buffer.from(padded, 'base64url').length).toBe(33)

    const fixed = normaliseKey(padded, 32)
    expect(fixed).toBe(pair.privateKey)
    expect(() =>
      webpush.setVapidDetails('mailto:josh@lighthousecare.org.au', pair.publicKey, fixed),
    ).not.toThrow()
  })

  it('does not strip a leading zero that is part of a correct-length key', () => {
    // Only the one-byte-too-long case is an artefact. A key that is already
    // the right size keeps every byte, whatever it starts with.
    const zeroLed = Buffer.concat([Buffer.from([0]), Buffer.alloc(31, 7)]).toString('base64url')
    expect(normaliseKey(zeroLed, 32)).toBe(zeroLed)
  })
})
