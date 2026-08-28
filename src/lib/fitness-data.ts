import prisma from '@/lib/prisma'
import { brisbaneToday, calendarDay, calendarDayString } from '@/lib/fitness-days'

/**
 * Everything the challenge page shows, worked out in one pass.
 *
 * The whole challenge is at most a month of entries for a few dozen staff, so
 * it's cheaper and far simpler to pull the rows once and aggregate in code than
 * to run a groupBy per view. It also means the daily series can include days
 * nobody logged, which a groupBy can't — and a bar chart with missing days
 * silently lies about the shape of the month.
 */

export interface DayPoint {
  /** yyyy-mm-dd */
  day: string
  /** "Tue 3" */
  label: string
  total: number
  walkers: number
  /** Who did the most that day. Null on days nobody logged. */
  leader: { name: string; amount: number } | null
  /** A day that hasn't happened yet — drawn as an empty slot, not a zero. */
  future: boolean
}

export interface Standing {
  userId: string
  name: string
  total: number
  days: number
}

export interface ChallengeBoard {
  days: DayPoint[]
  top: Standing[]
  total: number
  participants: number
  /** Index into `days` for today, or -1 if today sits outside the challenge. */
  todayIndex: number
  bestDay: DayPoint | null
}

function firstName(full: string | null): string {
  const n = (full ?? '').trim()
  if (!n) return 'Someone'
  const [first, ...rest] = n.split(/\s+/)
  // First name plus an initial — enough to tell two Sarahs apart without
  // putting everyone's full name on a leaderboard.
  return rest.length > 0 ? `${first} ${rest[rest.length - 1][0]}.` : first
}

/** Every yyyy-mm-dd from start to end inclusive, as calendar days. */
function dayRange(startsAt: Date, endsAt: Date): string[] {
  const BNE = 'Australia/Brisbane'
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: BNE, year: 'numeric', month: '2-digit', day: '2-digit' })
  const out: string[] = []
  let cursor = calendarDay(fmt.format(startsAt))
  const last = calendarDay(fmt.format(endsAt))
  if (!cursor || !last) return out
  while (cursor <= last && out.length < 400) {
    out.push(calendarDayString(cursor))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return out
}

export async function getChallengeBoard(challenge: {
  id: string
  startsAt: Date
  endsAt: Date
}): Promise<ChallengeBoard> {
  const entries = await prisma.fitnessEntry.findMany({
    where: { challengeId: challenge.id },
    select: { day: true, amount: true, userId: true, user: { select: { name: true } } },
  })

  const today = brisbaneToday()
  const byDay = new Map<string, { total: number; walkers: number; leader: { name: string; amount: number } | null }>()
  const byPerson = new Map<string, Standing>()

  for (const e of entries) {
    if (e.amount <= 0) continue
    const key = calendarDayString(e.day)
    const name = firstName(e.user.name)

    const d = byDay.get(key) ?? { total: 0, walkers: 0, leader: null }
    d.total += e.amount
    d.walkers += 1
    if (!d.leader || e.amount > d.leader.amount) d.leader = { name, amount: e.amount }
    byDay.set(key, d)

    const p = byPerson.get(e.userId) ?? { userId: e.userId, name, total: 0, days: 0 }
    p.total += e.amount
    p.days += 1
    byPerson.set(e.userId, p)
  }

  const days: DayPoint[] = dayRange(challenge.startsAt, challenge.endsAt).map((day) => {
    const d = byDay.get(day)
    const date = calendarDay(day)!
    return {
      day,
      label: new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).format(date),
      total: d?.total ?? 0,
      walkers: d?.walkers ?? 0,
      leader: d?.leader ?? null,
      future: day > today,
    }
  })

  const withSteps = days.filter((d) => d.total > 0)
  const bestDay = withSteps.length
    ? withSteps.reduce((best, d) => (d.total > best.total ? d : best), withSteps[0])
    : null

  const standings = [...byPerson.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  return {
    days,
    top: standings.slice(0, 5),
    total: standings.reduce((sum, s) => sum + s.total, 0),
    participants: standings.length,
    todayIndex: days.findIndex((d) => d.day === today),
    bestDay,
  }
}

/**
 * The tip for a given day. Rotates through the active tips by date so everyone
 * sees the same one, it changes at midnight, and it doesn't jump about when a
 * tip is added or edited mid-month.
 */
export async function getTipOfTheDay(day: string = brisbaneToday()): Promise<string | null> {
  const tips = await prisma.wellbeingTip.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { body: true },
  })
  if (tips.length === 0) return null
  const date = calendarDay(day)
  const index = date ? Math.floor(date.getTime() / 86_400_000) % tips.length : 0
  return tips[index].body
}

export interface ScheduleItem {
  id: string
  title: string
  weekday: number
  startTime: string
  endTime: string | null
  location: string | null
  leader: string | null
  notes: string | null
  isToday: boolean
}

/** The weekly wellbeing schedule, Monday first, with today flagged. */
export async function getWellbeingSchedule(): Promise<ScheduleItem[]> {
  const rows = await prisma.wellbeingSession.findMany({
    where: { isActive: true },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }, { sortOrder: 'asc' }],
  })
  const todayWeekday =
    ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[
      new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short' }).format(new Date())
    ] ?? 0

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    weekday: r.weekday,
    startTime: r.startTime,
    endTime: r.endTime,
    location: r.location,
    leader: r.leader,
    notes: r.notes,
    isToday: r.weekday === todayWeekday,
  }))
}
