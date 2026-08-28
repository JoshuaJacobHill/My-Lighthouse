import crypto from 'crypto'

/**
 * The personal code a phone uses to send its step count.
 *
 * Deliberately short and readable — `LH-7K4M-92QX` rather than 32 characters of
 * base64. Staff have to get this into the Shortcuts app on a phone, and a code
 * you can read off a screen and type is worth far more here than the extra
 * entropy of a blob you can only paste.
 *
 * The alphabet drops the characters people confuse: no 0/O, no 1/I/L, no U/V.
 * Eight characters from a 28-letter alphabet is about 38 bits — some 380
 * billion possibilities. Paired with the rate limit on the endpoint, guessing
 * one is hopeless, and the prize for succeeding would be the ability to add
 * steps to one person's tally on a staff wellbeing challenge.
 */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTWXY'

export function generateFitnessCode(): string {
  const bytes = crypto.randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
    if (i === 3) out += '-'
  }
  return `LH-${out}`
}

/**
 * Accept what people actually type: any case, spaces, missing dashes. Long
 * legacy tokens pass through untouched so links made before this still work.
 */
export function normaliseFitnessCode(input: string): string {
  const raw = input.trim()
  if (raw.startsWith('lhf_')) return raw // legacy token, case-sensitive

  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
  // Take the last eight characters rather than trusting the prefix: someone
  // typing "1H" for "LH" shouldn't be told their code is wrong, and the eight
  // that matter are always at the end.
  const body = cleaned.length >= 8 ? cleaned.slice(-8) : cleaned
  if (body.length !== 8) return raw
  return `LH-${body.slice(0, 4)}-${body.slice(4)}`
}
