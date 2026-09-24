/**
 * Drop-off days, and the hours on each of them.
 *
 * Stored in the existing `GiftProgramPartner.dropOffDays` string array, one
 * entry per open day:
 *
 *   "2026-12-01"                 open that day, hours not stated
 *   "2026-12-01|09:00|12:00"     open that day, 9am to noon
 *
 * Encoded rather than given its own table or JSON column because the shape is
 * genuinely this small, and because it needs no migration — a column that is
 * already live keeps working, and bare dates written before times existed
 * still parse. Anything unreadable is dropped rather than guessed at: a
 * half-understood opening time is worse than none.
 *
 * Pure and Prisma-free, so the form and the action agree on one definition.
 */

export type DropOffDay = {
  /** Brisbane calendar day, `YYYY-MM-DD`. */
  date: string
  /** `HH:MM`, or null for "no particular hours". */
  from: string | null
  to: string | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function parseDay(entry: string): DropOffDay | null {
  const [date, from, to] = String(entry ?? '').split('|')
  if (!DATE.test(date ?? '')) return null

  const valid = (t?: string) => (t && TIME.test(t) ? t : null)
  const start = valid(from)
  const end = valid(to)

  // Both or neither. A start with no end says nothing useful, and an end
  // before its start is a mistake we should not render as though it were real.
  if (start && end && end <= start) return { date, from: null, to: null }
  if (!start || !end) return { date, from: null, to: null }
  return { date, from: start, to: end }
}

export function formatDay(day: DropOffDay): string {
  return day.from && day.to ? `${day.date}|${day.from}|${day.to}` : day.date
}

/** Parse a stored list, dropping anything unreadable, sorted by day. */
export function parseDays(entries: string[] | null | undefined): DropOffDay[] {
  return (entries ?? [])
    .map(parseDay)
    .filter((d): d is DropOffDay => d !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** "Mon 1 Dec". Read in UTC, because these are stored as calendar days. */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return date
  // en-AU gives "Tue, 1 Dec"; the comma is dropped so that adding a time reads
  // as one clause — "Tue 1 Dec, 9am–12pm" rather than two commas in a row.
  return d
    .toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
    .replace(',', '')
}

/** "9am", "9:30am", "12pm" — the way somebody would say it, not 24-hour. */
export function timeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

/** "Mon 1 Dec, 9am–12pm", or just the day when no hours were given. */
export function describeDay(day: DropOffDay): string {
  const label = dayLabel(day.date)
  return day.from && day.to ? `${label}, ${timeLabel(day.from)}–${timeLabel(day.to)}` : label
}

/**
 * Every calendar day between two dates, inclusive.
 *
 * Capped, so a mistyped year cannot ask for a thousand rows.
 */
export function datesBetween(from: string, to: string, limit = 60): string[] {
  if (!DATE.test(from) || !DATE.test(to) || to < from) return []
  const out: string[] = []
  const cursor = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  while (cursor <= end && out.length < limit) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

/**
 * Keep only the days inside a window.
 *
 * A window somebody shortened must not leave a day advertised outside it —
 * that is a shopper driving to a locked door.
 */
export function withinWindow(
  days: DropOffDay[],
  opensAt: string | null,
  closesAt: string | null,
): DropOffDay[] {
  return days.filter((d) => {
    if (opensAt && d.date < opensAt) return false
    if (closesAt && d.date > closesAt) return false
    return true
  })
}
