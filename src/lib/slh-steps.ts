/**
 * The chain a shopper works through, per child.
 *
 * Pure and Prisma-free so both the server pages and the client step buttons
 * can import it. The database stores six nullable timestamps on `GiftChild`
 * rather than a status column, and this is what turns them into an ordered
 * list of steps with a "next" — the only two questions anybody asks of them.
 *
 * Progress is **per wish list**. An overall "8 of 18 steps" bar was removed
 * from the design on purpose: it measured nothing a shopper acts on.
 */

export const WISH_STEPS = [
  { key: 'received', title: 'Wish list received', hint: 'Confirm you have this list' },
  { key: 'shopped', title: 'Wish list fulfilled', hint: 'A photo of the gifts before wrapping' },
  { key: 'wrapped', title: 'Gifts wrapped', hint: 'A photo of them wrapped' },
  { key: 'labels', title: 'Ready for delivery', hint: 'Print the gift tags' },
  { key: 'dropoff', title: 'Drop-off booked', hint: 'Pick a time to bring them in' },
  { key: 'delivered', title: 'Delivered', hint: 'Scanned in at drop-off' },
] as const

export type WishStepKey = (typeof WISH_STEPS)[number]['key']

/** The four gifts, in the order the program asks for them. */
export const WISH_KINDS = [
  ['want', 'Something they want'],
  ['need', 'Something they need'],
  ['wear', 'Something to wear'],
  ['read', 'Something to read'],
] as const

/** The shape the timestamps arrive in — a `GiftChild`, or anything like one. */
export type StepTimes = {
  receivedAt?: Date | null
  shoppedAt?: Date | null
  wrappedAt?: Date | null
  labelsAt?: Date | null
  dropoffAt?: Date | null
  deliveredAt?: Date | null
}

const FIELD: Record<WishStepKey, keyof StepTimes> = {
  received: 'receivedAt',
  shopped: 'shoppedAt',
  wrapped: 'wrappedAt',
  labels: 'labelsAt',
  dropoff: 'dropoffAt',
  delivered: 'deliveredAt',
}

/** The column a step writes to, so an action can set it by key. */
export function stepField(key: WishStepKey): keyof StepTimes {
  return FIELD[key]
}

export function stepDone(child: StepTimes, key: WishStepKey): boolean {
  return Boolean(child[FIELD[key]])
}

/** Which steps are done. Counted, not assumed to be contiguous. */
export function doneSteps(child: StepTimes): WishStepKey[] {
  return WISH_STEPS.filter((s) => stepDone(child, s.key)).map((s) => s.key)
}

export function doneCount(child: StepTimes): number {
  return doneSteps(child).length
}

/**
 * The next thing to do, or null when the list is finished.
 *
 * The **first** step not done, rather than the one after the last done step.
 * Somebody who ticks "wrapped" before "shopped" — which happens — should be
 * sent back to the gap, not marched past it.
 */
export function nextStep(child: StepTimes): (typeof WISH_STEPS)[number] | null {
  return WISH_STEPS.find((s) => !stepDone(child, s.key)) ?? null
}

export function listComplete(child: StepTimes): boolean {
  return nextStep(child) === null
}

/**
 * Age in whole years on a given day, from a date of birth.
 *
 * Stored as a date, not an age, because an age is wrong by December. Dates
 * arrive as midnight UTC (`@db.Date`), so this reads the UTC parts rather than
 * local ones — reading them locally in Brisbane would shift the day back and
 * make a birthday land a day early.
 */
export function ageOn(dateOfBirth: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const monthDiff = on.getUTCMonth() - dateOfBirth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1
  return Math.max(0, age)
}

/**
 * Whole days from today until a Brisbane calendar day.
 *
 * Both sides are floored to a day first, so "in 1 day" means tomorrow rather
 * than any instant 24 hours out, and a deadline today reads as 0 all day.
 */
export function daysUntil(when: Date, from: Date = new Date()): number {
  const DAY = 24 * 60 * 60 * 1000
  const brisbaneDay = (d: Date) => Math.floor((d.getTime() + 10 * 60 * 60 * 1000) / DAY)
  return brisbaneDay(when) - brisbaneDay(from)
}
