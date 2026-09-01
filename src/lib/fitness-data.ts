import { cache } from 'react'
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

/**
 * The challenge to show right now.
 *
 * Prefers one that is actually running today; if none is, falls back to the
 * next one due to start. Ordering by start date alone would mean a short test
 * run today loses to a bigger challenge starting next week — and, worse, that
 * ending the test would need someone to remember to switch the other one back
 * on. This way the handover happens on its own.
 */
export const getCurrentChallenge = cache(async function getCurrentChallenge() {
  const now = new Date()
  // One query rather than two. Sorting by "is it running right now" first means
  // the running challenge wins and the next one due to start is the fallback,
  // without a second round trip to find out.
  const candidates = await prisma.fitnessChallenge.findMany({
    where: { isActive: true, endsAt: { gte: now } },
    orderBy: { startsAt: 'asc' },
    take: 5,
  })
  return candidates.find((c) => c.startsAt <= now) ?? candidates[0] ?? null
})

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

export type LeaderWindow = 'today' | 'week' | 'month'

export interface ChallengeBoard {
  days: DayPoint[]
  /** Top five over each window. Same pass, no extra queries. */
  top: Record<LeaderWindow, Standing[]>
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
  // Monday of the current week, as a calendar day string, so entries can be
  // bucketed by comparing strings rather than juggling timezones.
  const todayDate = calendarDay(today)!
  const weekday = ((todayDate.getUTCDay() + 6) % 7) + 1 // 1 = Mon
  const weekStart = calendarDayString(new Date(todayDate.getTime() - (weekday - 1) * 86_400_000))

  const byDay = new Map<string, { total: number; walkers: number; leader: { name: string; amount: number } | null }>()
  const byPerson: Record<LeaderWindow, Map<string, Standing>> = {
    today: new Map(),
    week: new Map(),
    month: new Map(),
  }

  const addTo = (window: LeaderWindow, userId: string, name: string, amount: number) => {
    const p = byPerson[window].get(userId) ?? { userId, name, total: 0, days: 0 }
    p.total += amount
    p.days += 1
    byPerson[window].set(userId, p)
  }

  for (const e of entries) {
    if (e.amount <= 0) continue
    const key = calendarDayString(e.day)
    const name = firstName(e.user.name)

    const d = byDay.get(key) ?? { total: 0, walkers: 0, leader: null }
    d.total += e.amount
    d.walkers += 1
    if (!d.leader || e.amount > d.leader.amount) d.leader = { name, amount: e.amount }
    byDay.set(key, d)

    addTo('month', e.userId, name, e.amount)
    if (key >= weekStart) addTo('week', e.userId, name, e.amount)
    if (key === today) addTo('today', e.userId, name, e.amount)
  }

  const rank = (m: Map<string, Standing>) =>
    [...m.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

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

  const standings = rank(byPerson.month)

  return {
    days,
    top: {
      today: rank(byPerson.today).slice(0, 5),
      week: rank(byPerson.week).slice(0, 5),
      month: standings.slice(0, 5),
    },
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
  /** The actual date this weekday falls on in the week being shown, yyyy-mm-dd. */
  date: string
  /** "Tuesday 1 September" */
  dateLabel: string
}

/**
 * The weekly wellbeing schedule with real dates attached.
 *
 * Sessions are stored as weekdays because they recur, but "Tuesday" on its own
 * is ambiguous when you are looking at it on a Thursday. Each one is resolved
 * to the date it falls on in the current week, clamped into the challenge so
 * the first week does not advertise sessions from before it started.
 */
export async function getWellbeingSchedule(challenge?: {
  startsAt: Date
  endsAt: Date
}): Promise<ScheduleItem[]> {
  const rows = await prisma.wellbeingSession.findMany({
    where: { isActive: true },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }, { sortOrder: 'asc' }],
  })

  const today = brisbaneToday()
  const todayDate = calendarDay(today)!
  const todayWeekday = ((todayDate.getUTCDay() + 6) % 7) + 1 // 1 = Mon … 7 = Sun

  // Monday of the week we are in.
  const monday = new Date(todayDate.getTime() - (todayWeekday - 1) * 86_400_000)

  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const items = rows.map((r) => {
    let date = new Date(monday.getTime() + (r.weekday - 1) * 86_400_000)
    // During the challenge's first week, roll a session that has already passed
    // forward to next week rather than showing a date before it began.
    if (challenge && date < challenge.startsAt) {
      const next = new Date(date.getTime() + 7 * 86_400_000)
      if (next <= challenge.endsAt) date = next
    }
    return {
      id: r.id,
      title: r.title,
      weekday: r.weekday,
      startTime: r.startTime,
      endTime: r.endTime,
      location: r.location,
      leader: r.leader,
      notes: r.notes,
      isToday: calendarDayString(date) === today,
      date: calendarDayString(date),
      dateLabel: fmt.format(date),
    }
  })

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

export interface Cheer {
  id: string
  body: string
  name: string
  mine: boolean
  at: string
}

/** Today's notes only. Yesterday's are cleared by the daily cron. */
export async function getTodaysCheers(challengeId: string, meId: string): Promise<Cheer[]> {
  const day = calendarDay(brisbaneToday())
  if (!day) return []
  const rows = await prisma.challengeCheer.findMany({
    where: { challengeId, day },
    select: { id: true, body: true, createdAt: true, userId: true, user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    name: firstName(r.user.name),
    mine: r.userId === meId,
    at: new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Brisbane',
      hour: 'numeric',
      minute: '2-digit',
    }).format(r.createdAt),
  }))
}
