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
function normaliseKey(raw: string): string {
  return raw.trim().replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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
        normaliseKey(pair.publicKey),
        normaliseKey(standard),
      ),
    ).not.toThrow()
  })

  it('survives the trailing newline an environment variable picks up', () => {
    expect(normaliseKey(`${pair.privateKey}\n`)).toBe(pair.privateKey)
    expect(normaliseKey(`  ${pair.privateKey}  `)).toBe(pair.privateKey)
  })

  it('leaves a key that is already right exactly as it is', () => {
    expect(normaliseKey(pair.privateKey)).toBe(pair.privateKey)
    expect(normaliseKey(pair.publicKey)).toBe(pair.publicKey)
  })

  it('knows the sizes it is checking for', () => {
    const bytes = (k: string) => Math.floor((normaliseKey(k).length * 3) / 4)
    expect(bytes(pair.privateKey)).toBe(32)
    expect(bytes(pair.publicKey)).toBe(65)
  })
})
