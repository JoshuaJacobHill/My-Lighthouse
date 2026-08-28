/**
 * Calendar-day handling for the fitness challenge.
 *
 * `FitnessEntry.day` is a `@db.Date` — a calendar day with no time and no zone.
 * The trap: building it as `new Date('2026-09-03T00:00:00+10:00')` gives
 * 2026-09-02T14:00Z, and Postgres keeps only the UTC date part, so the row
 * lands on the 2nd. Every entry silently shifts a day earlier, and the "have I
 * logged today?" lookup then never matches.
 *
 * So a calendar day is always stored as midnight UTC, and read back the same
 * way. Which day it *is* still comes from Brisbane's clock — that part is the
 * user's local date, and Queensland has no daylight saving.
 */

const BNE = 'Australia/Brisbane'

/** Today's date in Brisbane, as yyyy-mm-dd. */
export function brisbaneToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BNE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** The value to store for a yyyy-mm-dd day, or null if it isn't a real date. */
export function calendarDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const at = new Date(`${day}T00:00:00.000Z`)
  if (Number.isNaN(at.getTime())) return null
  // Rejects the likes of 2026-02-31, which Date would roll forward silently.
  if (at.toISOString().slice(0, 10) !== day) return null
  return at
}

/** yyyy-mm-dd back out of a stored day. */
export function calendarDayString(day: Date): string {
  return day.toISOString().slice(0, 10)
}
