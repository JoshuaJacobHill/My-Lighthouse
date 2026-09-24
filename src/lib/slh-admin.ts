/**
 * The two admin lists: shoppers, and wish lists.
 *
 * Pure and Prisma-free — the statuses and their labels are decided here so the
 * page, the filter menu and the counts all agree. One route serves both
 * audiences: Lighthouse sees every enrolled organisation, an organisation's
 * admin sees only their own. Naming them after the domain rather than the
 * audience is why there is one of each rather than four.
 */

/* ── Shoppers ─────────────────────────────────────────────────────────────── */

export type ShopperStatus = 'waiting' | 'shopping' | 'delivered' | 'stepped-back'

export const SHOPPER_STATUS: Record<ShopperStatus, { label: string; hint: string }> = {
  waiting: {
    label: 'Waiting for a list',
    hint: 'Signed up and asked for more lists than they are holding',
  },
  shopping: { label: 'Shopping', hint: 'Holding lists, not all delivered yet' },
  delivered: { label: 'Delivered', hint: 'Every list they hold is finished' },
  'stepped-back': {
    label: 'Stepped back',
    hint: 'Asked for none this year, and holding none',
  },
}

/**
 * Where a shopper is up to.
 *
 * "Waiting" is the one that matters operationally: somebody who has asked for
 * three lists and been given one is waiting for two, and they are the reason
 * the waiting list exists. It is derived rather than stored, so it cannot go
 * stale when a list is assigned or handed back.
 */
export function shopperStatus(input: {
  requested: number
  held: number
  delivered: number
}): ShopperStatus {
  if (input.held === 0) return input.requested > 0 ? 'waiting' : 'stepped-back'
  if (input.held < input.requested) return 'waiting'
  return input.delivered >= input.held ? 'delivered' : 'shopping'
}

/** How many lists this shopper is still owed. Never negative. */
export function shortfall(input: { requested: number; held: number }): number {
  return Math.max(0, input.requested - input.held)
}

/* ── Wish lists ───────────────────────────────────────────────────────────── */

export type ListStatus = 'unfilled' | 'ready' | 'assigned' | 'delivered'

export const LIST_STATUS: Record<ListStatus, { label: string; hint: string }> = {
  unfilled: {
    label: 'Not filled in',
    hint: 'The four gifts are not all answered — chase the family',
  },
  ready: { label: 'Ready for a shopper', hint: 'Filled in and waiting to be handed out' },
  assigned: { label: 'With a shopper', hint: 'Somebody is shopping for this child' },
  delivered: { label: 'Delivered', hint: 'Gifts are in' },
}

/**
 * Where a wish list is up to.
 *
 * Deliberately ordered by what somebody would act on: an unfilled list is a
 * phone call to a family, a ready one is a list to hand out, an assigned one
 * needs nothing. A list that is assigned but *not* filled in still reads as
 * "not filled in", because that is the more urgent fact — a shopper is
 * holding a list nobody has answered.
 */
export function listStatus(input: {
  filled: boolean
  shopperId: string | null
  deliveredAt: Date | null
}): ListStatus {
  if (input.deliveredAt) return 'delivered'
  if (!input.filled) return 'unfilled'
  return input.shopperId ? 'assigned' : 'ready'
}

/* ── Filters ──────────────────────────────────────────────────────────────── */

/**
 * Read a filter out of a query string.
 *
 * Anything unrecognised becomes "all" rather than an error. A filter is a way
 * of looking at a list; a mistyped URL should show you everything, not a
 * screen full of apology.
 */
export function oneOf<T extends string>(raw: unknown, allowed: readonly T[]): T | 'all' {
  const value = String(raw ?? '').trim()
  return (allowed as readonly string[]).includes(value) ? (value as T) : 'all'
}

export const AGE_FILTERS = [
  ['0-4', '0–4'],
  ['5-8', '5–8'],
  ['9-12', '9–12'],
  ['13-17', '13–17'],
] as const

/** The inclusive year range a band covers, for filtering by date of birth. */
export function ageRange(band: string): { min: number; max: number } | null {
  const found = AGE_FILTERS.find(([value]) => value === band)
  if (!found) return null
  const [min, max] = found[0].split('-').map(Number)
  return { min, max }
}

/**
 * The birthdays that fall inside an age band, as a date range.
 *
 * Inverted on purpose: comparing stored dates beats computing an age for every
 * row and filtering in memory. Someone who is 8 was born on or before today
 * minus 8 years, and after today minus 9 years.
 */
export function birthdayWindow(band: string, on: Date = new Date()) {
  const range = ageRange(band)
  if (!range) return null

  const year = on.getUTCFullYear()
  const month = on.getUTCMonth()
  const day = on.getUTCDate()

  return {
    // Oldest: born just after their (max + 1)th birthday would have passed.
    gt: new Date(Date.UTC(year - range.max - 1, month, day)),
    // Youngest: born on or before the day they turned `min`.
    lte: new Date(Date.UTC(year - range.min, month, day)),
  }
}
