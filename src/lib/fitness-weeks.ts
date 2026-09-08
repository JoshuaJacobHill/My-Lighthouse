/**
 * Challenge weeks.
 *
 * Weeks run from the day the challenge started, not from Monday. September
 * 2026 began on a Tuesday, so week one is Tue 1 — Mon 7, and a Monday-based
 * week would have split it in two and produced a "winner" of a four-day
 * fragment.
 *
 * A winner is only ever declared for a week that has finished. Naming someone
 * on a Thursday, then someone else on the Friday, would make the badge
 * meaningless — and would tell whoever was ahead mid-week that they had won.
 */

import prisma from '@/lib/prisma'
import { brisbaneToday, calendarDay, calendarDayString } from '@/lib/fitness-days'

const DAY = 86_400_000

export type WeekWinner = {
  userId: string
  name: string
  steps: number
}

export type ChallengeWeek = {
  /** 1-based, as people say it: "week one". */
  number: number
  from: Date
  to: Date
  label: string
  /** Every day in the week has passed, so the result is final. */
  complete: boolean
  /** True for the week we are living in. */
  current: boolean
  /** Only set once the week is complete. Null on a tie with no entries. */
  winner: WeekWinner | null
  /** Everyone's total for the week, biggest first — the runners-up. */
  standings: WeekWinner[]
  total: number
}

function label(from: Date, to: Date): string {
  const f = (d: Date, withMonth: boolean) =>
    new Intl.DateTimeFormat('en-AU', {
      timeZone: 'UTC',
      day: 'numeric',
      ...(withMonth ? { month: 'short' } : {}),
    }).format(d)
  const sameMonth = from.getUTCMonth() === to.getUTCMonth()
  return `${f(from, !sameMonth)} – ${f(to, true)}`
}

/**
 * Every week of the challenge, with the winner of each completed one.
 *
 * One query for the whole challenge and the grouping done in code: the entry
 * table is small, and this way a week with nobody logging still appears rather
 * than silently vanishing from the carousel.
 */
export async function getChallengeWeeks(challenge: {
  id: string
  startsAt: Date
  endsAt: Date
}): Promise<ChallengeWeek[]> {
  const todayStr = brisbaneToday()
  const today = calendarDay(todayStr)
  if (!today) return []

  // The challenge's first Brisbane day. startsAt is an instant (midnight
  // Brisbane), so read the date in Brisbane rather than UTC or it lands a day
  // early.
  const firstStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
  }).format(challenge.startsAt)
  const first = calendarDay(firstStr)
  const lastStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
  }).format(challenge.endsAt)
  const last = calendarDay(lastStr)
  if (!first || !last) return []

  const entries = await prisma.fitnessEntry.findMany({
    where: { challengeId: challenge.id },
    select: { userId: true, day: true, amount: true, user: { select: { name: true, email: true } } },
  })

  const weeks: ChallengeWeek[] = []
  for (let n = 1; ; n++) {
    const from = new Date(first.getTime() + (n - 1) * 7 * DAY)
    if (from > last) break
    // A final short week is fine: it ends when the challenge does.
    const to = new Date(Math.min(from.getTime() + 6 * DAY, last.getTime()))

    const totals = new Map<string, WeekWinner>()
    let total = 0
    for (const e of entries) {
      if (e.day < from || e.day > to) continue
      const key = e.userId
      const row = totals.get(key) ?? {
        userId: key,
        name: e.user.name ?? e.user.email,
        steps: 0,
      }
      row.steps += e.amount
      total += e.amount
      totals.set(key, row)
    }

    const standings = [...totals.values()].sort(
      (a, b) => b.steps - a.steps || a.name.localeCompare(b.name),
    )
    const complete = to < today
    const current = from <= today && today <= to

    weeks.push({
      number: n,
      from,
      to,
      label: label(from, to),
      complete,
      current,
      winner: complete ? standings[0] ?? null : null,
      standings,
      total,
    })
  }

  return weeks
}

/** The current challenge week as day strings, for the leaderboard's week view. */
export function currentWeekRange(
  startsAt: Date,
  now = new Date(),
): { from: string; to: string } | null {
  const firstStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(
    startsAt,
  )
  const first = calendarDay(firstStr)
  const today = calendarDay(brisbaneToday(now))
  if (!first || !today) return null

  const elapsed = Math.floor((today.getTime() - first.getTime()) / DAY)
  if (elapsed < 0) return { from: firstStr, to: firstStr }

  const weekIndex = Math.floor(elapsed / 7)
  const from = new Date(first.getTime() + weekIndex * 7 * DAY)
  return {
    from: calendarDayString(from),
    to: calendarDayString(new Date(from.getTime() + 6 * DAY)),
  }
}
