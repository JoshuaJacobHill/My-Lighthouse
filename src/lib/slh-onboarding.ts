/**
 * Santa's Little Helpers — what a shopper chooses when they sign up.
 *
 * Pure, Prisma-free and importable from a Client Component, which is the whole
 * reason it is separate: the onboarding screens need these lists to render the
 * buttons, and the server action needs them to check what came back. One
 * definition, used by both, so a choice the UI offers can never be a choice the
 * action rejects.
 *
 * Everything here is a **preference**, not a promise — except the
 * acknowledgement, which is the one commitment a shopper makes.
 */

/** The steps, in order. Welcome is step 0: it asks for nothing. */
export const JOIN_STEPS = ['welcome', 'organisation', 'lists', 'done'] as const
export type JoinStep = (typeof JOIN_STEPS)[number]

/**
 * How many children somebody may take on.
 *
 * Deliberately a short list rather than a free number. Around $200 a child is
 * a lot of money, and a text box invites a figure typed in enthusiasm that
 * becomes a child without a present in December. Ten is the ceiling; a workplace
 * doing more than that is a conversation, not a form.
 */
export const WISHLIST_COUNTS = [1, 2, 3, 5, 10] as const

export const AGE_BANDS = [
  ['any', 'Any age'],
  ['0-4', '0–4'],
  ['5-8', '5–8'],
  ['9-12', '9–12'],
  ['13-17', '13–17'],
] as const

export const GENDERS = [
  ['any', 'Either'],
  ['girl', 'A girl'],
  ['boy', 'A boy'],
] as const

export type AgeBand = (typeof AGE_BANDS)[number][0]
export type Gender = (typeof GENDERS)[number][0]

/**
 * Clamp a requested count to something the program can honour.
 *
 * Anything unrecognised becomes 1 rather than an error. A shopper who fiddles
 * with the form gets one child, which is a safe wrong answer; refusing them
 * outright loses somebody who wanted to help.
 */
export function cleanCount(raw: unknown): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n)) return 1
  const rounded = Math.round(n)
  return (WISHLIST_COUNTS as readonly number[]).includes(rounded) ? rounded : 1
}

export function cleanAge(raw: unknown): AgeBand {
  const v = String(raw ?? '').trim()
  return (AGE_BANDS.find(([value]) => value === v)?.[0] ?? 'any') as AgeBand
}

export function cleanGender(raw: unknown): Gender {
  const v = String(raw ?? '').trim()
  return (GENDERS.find(([value]) => value === v)?.[0] ?? 'any') as Gender
}

export function ageLabel(value: string): string {
  return AGE_BANDS.find(([v]) => v === value)?.[1] ?? 'Any age'
}

export function genderLabel(value: string): string {
  return GENDERS.find(([v]) => v === value)?.[1] ?? 'Either'
}

/**
 * Is this sign-up complete enough to save?
 *
 * An organisation and a ticked acknowledgement. The preferences all have
 * defaults and the count is clamped, so neither can block somebody; the
 * acknowledgement can, because it is the one thing being agreed to.
 */
export function canSubmit(input: { organisationId?: string | null; acknowledged?: boolean }): boolean {
  return Boolean(input.organisationId) && input.acknowledged === true
}

/**
 * One line naming what a shopper asked for, for the confirmation screen and
 * for the organisation's side later.
 *
 * "2 wish lists · girls aged 5–8" reads as a sentence; the parts that are "any"
 * drop out rather than saying "any age, either" and adding nothing.
 */
export function describeRequest(input: {
  requested: number
  preferredAge: string
  preferredGender: string
}): string {
  const lists = `${input.requested} wish list${input.requested === 1 ? '' : 's'}`

  const who: string[] = []
  if (input.preferredGender !== 'any') {
    who.push(input.preferredGender === 'girl' ? 'a girl' : 'a boy')
  }
  if (input.preferredAge !== 'any') {
    who.push(`aged ${ageLabel(input.preferredAge)}`)
  }

  return who.length > 0 ? `${lists} · ${who.join(', ')}` : lists
}
