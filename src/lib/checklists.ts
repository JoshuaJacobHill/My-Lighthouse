import type { ChecklistFrequency } from '@prisma/client'

const BNE = 'Australia/Brisbane'

/** Brisbane calendar parts for an instant. */
function parts(at: Date): { y: number; m: number; d: number; hh: number; mm: number; weekday: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: BNE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(at)
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '0'
  const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hh: Number(get('hour')),
    mm: Number(get('minute')),
    weekday: WD[get('weekday')] ?? 1,
  }
}

/** ISO week number, for stable weekly period keys. */
function isoWeek(y: number, m: number, d: number): { year: number; week: number } {
  const dt = new Date(Date.UTC(y, m - 1, d))
  const day = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { year: dt.getUTCFullYear(), week }
}

/**
 * Identify the current occurrence of a recurring item. Occurrences aren't stored
 * — a completion row for this key means "done", its absence means "not yet". So
 * nothing has to generate rows ahead of time, and history is exact.
 */
export function periodKey(frequency: ChecklistFrequency, at: Date = new Date()): string {
  const p = parts(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (frequency === 'DAILY') return `${p.y}-${pad(p.m)}-${pad(p.d)}`
  if (frequency === 'MONTHLY') return `${p.y}-${pad(p.m)}`
  const { year, week } = isoWeek(p.y, p.m, p.d)
  return `${year}-W${pad(week)}`
}

/** Human label for the current period, for the UI. */
export function periodLabel(frequency: ChecklistFrequency, at: Date = new Date()): string {
  if (frequency === 'DAILY') return 'today'
  if (frequency === 'WEEKLY') return 'this week'
  return 'this month'
}

/**
 * Is this occurrence past its hard deadline and still not done?
 *
 * DAILY  — overdue after dueTime on the day.
 * WEEKLY — overdue after dueTime on its weekday (defaults to Sunday, so it stays
 *          actionable all week rather than nagging on Monday morning).
 * MONTHLY— overdue after dueTime on its day of month (defaults to the last day).
 */
export function isOverdue(
  item: { frequency: ChecklistFrequency; dueTime: string | null; weekday: number | null; dayOfMonth: number | null },
  at: Date = new Date()
): boolean {
  const p = parts(at)
  const [dh, dm] = (item.dueTime ?? '23:59').split(':').map(Number)
  const pastTimeToday = p.hh > dh || (p.hh === dh && p.mm >= (dm || 0))

  if (item.frequency === 'DAILY') return pastTimeToday

  if (item.frequency === 'WEEKLY') {
    const target = item.weekday ?? 7
    if (p.weekday > target) return true
    return p.weekday === target && pastTimeToday
  }

  // MONTHLY — last day of the Brisbane month when unspecified.
  const lastDay = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate()
  const target = Math.min(item.dayOfMonth ?? lastDay, lastDay)
  if (p.d > target) return true
  return p.d === target && pastTimeToday
}
