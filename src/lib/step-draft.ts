import crypto from 'crypto'

/**
 * A signed hand-off for a step reading between two requests.
 *
 * The share target posts an image to one URL and the person confirms it on
 * another, so the reading has to survive a redirect. Putting the number in a
 * query string on its own would undo the whole point of removing the manual
 * entry box: anyone could edit the URL and log whatever they liked.
 *
 * So the values are signed with the session secret and checked on the way back
 * in. Stateless, tamper evident, and nothing extra to store or clean up.
 */

const MAX_AGE_MS = 15 * 60 * 1000

/**
 * Read at call time rather than module load. Capturing it at import made the
 * module untestable, and worse, would have let encoding sign with an empty key
 * while decoding silently rejected everything.
 */
function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET is not set; step drafts cannot be signed.')
  return value
}

export interface StepDraft {
  steps: number
  day: string
  assumed: boolean
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

/** Query string carrying a reading, tied to one user and a 15 minute window. */
export function encodeDraft(userId: string, draft: StepDraft): string {
  const issuedAt = Date.now()
  const payload = [userId, draft.steps, draft.day, draft.assumed ? '1' : '0', issuedAt].join('.')
  const params = new URLSearchParams({
    s: String(draft.steps),
    d: draft.day,
    a: draft.assumed ? '1' : '0',
    t: String(issuedAt),
    sig: sign(payload),
  })
  return params.toString()
}

export function decodeDraft(userId: string, params: URLSearchParams): StepDraft | null {
  const s = params.get('s')
  const d = params.get('d')
  const a = params.get('a')
  const t = params.get('t')
  const sig = params.get('sig')
  if (!s || !d || !a || !t || !sig) return null

  const issuedAt = Number(t)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return null

  let expected: string
  try {
    expected = sign([userId, s, d, a, t].join('.'))
  } catch {
    return null
  }
  // Constant time, so a wrong signature cannot be narrowed down by timing.
  const ok =
    expected.length === sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  if (!ok) return null

  const steps = Number(s)
  if (!Number.isFinite(steps) || steps < 0 || steps > 200_000) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null

  return { steps, day: d, assumed: a === '1' }
}
