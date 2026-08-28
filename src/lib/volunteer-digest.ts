import prisma from '@/lib/prisma'
import type { StoreLocation } from '@/lib/coordinators'

/**
 * The weekly coordinator digest.
 *
 * Every number in here is computed from the database in this file. The AI layer
 * (`src/lib/digest-narrative.ts`) only ever *phrases* these facts — it never
 * produces a figure, a name, or a count of its own. This matters because the
 * digest talks about named volunteers ("we haven't seen Sean for five weeks")
 * and goes to the coordinator who knows them; an invented or misattributed
 * detail would be worse than no digest at all.
 *
 * Queensland has no daylight saving, so Brisbane is always UTC+10 and week
 * boundaries can be plain arithmetic.
 */

const BNE_OFFSET_MS = 10 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Hour milestones worth a mention when someone crosses one. */
const HOUR_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2000]

/** Someone is "active" if they've been in within this many weeks. */
const ACTIVE_WEEKS = 6
/** Past this, they're heading for the 3-month auto-deactivation. */
const LAPSED_WEEKS = 12
/** A "regular" — enough visits that dropping off is worth a phone call. */
const REGULAR_VISITS = 3

// ─── Week maths ───────────────────────────────────────────────────────────────

/** UTC instant of Monday 00:00 Brisbane, for the week containing `at`. */
function brisbaneWeekStart(at: Date): Date {
  const shifted = new Date(at.getTime() + BNE_OFFSET_MS)
  const dow = shifted.getUTCDay() || 7 // 1 = Mon … 7 = Sun
  const monday = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - (dow - 1))
  return new Date(monday - BNE_OFFSET_MS)
}

/** Brisbane date label, e.g. "18 Aug". */
function dayLabel(at: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    day: 'numeric',
    month: 'short',
  }).format(at)
}

function weeksBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / WEEK_MS)
}

// ─── Which coordinator does a volunteer belong to? ────────────────────────────
//
// `preferredLocations` is a mix: the apply form writes "Loganholme"/"Hillcrest",
// while admin-set rows carry full location names ("Hillcrest Store"). Match the
// same way `getCoordinatorEmail` does, so a volunteer's digest and their reply-to
// address never disagree. Anyone with no preference sits with Loganholme.
function homeStore(preferredLocations: string[]): StoreLocation {
  return preferredLocations.some((l) => /hillcrest/i.test(l)) ? 'Hillcrest' : 'Loganholme'
}

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface DigestPerson {
  name: string
  detail: string
}

export interface VolunteerDigest {
  store: StoreLocation
  weekLabel: string
  /** Mon 00:00 Brisbane of the reported week (inclusive). */
  weekStart: Date
  /** Mon 00:00 Brisbane of the following week (exclusive). */
  weekEnd: Date

  volunteersThisWeek: number
  volunteersLastWeek: number
  volunteersSameWeekLastYear: number
  visitsThisWeek: number
  hoursThisWeek: number

  /** Was the portal even taking attendance a year ago? */
  hasLastYearData: boolean

  // Mutually exclusive, and they add up to `rosterTotal` — a coordinator will
  // notice immediately if the buckets don't reconcile.
  active: number
  awaitingFirstShift: number
  lapsing: number
  lapsed: number
  onHold: number
  pendingInduction: number
  rosterTotal: number

  newThisWeek: DigestPerson[]
  firstShiftThisWeek: DigestPerson[]
  comingMoreOften: DigestPerson[]
  droppedOff: DigestPerson[]
  milestones: DigestPerson[]

  ratingCount: number
  averageRating: number | null
  comments: { name: string; rating: number | null; comment: string }[]

  /** Filled in by the AI layer when a key is configured; otherwise null. */
  narrative: { goodNews: string; needsAttention: string; general: string } | null
}

// ─── Build ────────────────────────────────────────────────────────────────────

/**
 * Facts for both stores in one pass. Runs Monday morning and reports on the week
 * that just finished, so the numbers are whole weeks and comparable — a partial
 * "this week" would always look like a collapse.
 */
export async function buildVolunteerDigests(now: Date = new Date()): Promise<VolunteerDigest[]> {
  const weekEnd = brisbaneWeekStart(now) // start of the current week = end of the reported one
  const weekStart = new Date(weekEnd.getTime() - WEEK_MS)
  const prevStart = new Date(weekStart.getTime() - WEEK_MS)
  // 52 whole weeks back, so last year's window is also Mon–Sun.
  const yearAgoStart = new Date(weekStart.getTime() - 52 * WEEK_MS)
  const yearAgoEnd = new Date(weekEnd.getTime() - 52 * WEEK_MS)
  const trendStart = new Date(weekEnd.getTime() - 8 * WEEK_MS)
  const trendMid = new Date(weekEnd.getTime() - 4 * WEEK_MS)

  const [roster, lifetime, thisWeekRows, prevRows, yearAgoRows, trendRows, feedback] = await Promise.all([
    prisma.volunteerProfile.findMany({
      where: { status: { notIn: ['REMOVED'] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        joinedAt: true,
        preferredLocations: true,
      },
    }),
    // One pass gives last-attended, lifetime visits and lifetime minutes for
    // everyone — derived from attendance rather than the cached
    // `lastAttendedAt` column, so the digest can't inherit a stale value.
    prisma.attendanceRecord.groupBy({
      by: ['volunteerId'],
      _max: { signInAt: true },
      _min: { signInAt: true },
      _count: { _all: true },
      _sum: { durationMins: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { signInAt: { gte: weekStart, lt: weekEnd } },
      select: { volunteerId: true, durationMins: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { signInAt: { gte: prevStart, lt: weekStart } },
      select: { volunteerId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { signInAt: { gte: yearAgoStart, lt: yearAgoEnd } },
      select: { volunteerId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { signInAt: { gte: trendStart, lt: weekEnd } },
      select: { volunteerId: true, signInAt: true },
    }),
    prisma.shiftFeedback.findMany({
      where: { ratedAt: { gte: weekStart, lt: weekEnd } },
      select: { volunteerId: true, rating: true, comment: true },
    }),
  ])

  const life = new Map(lifetime.map((r) => [r.volunteerId, r]))

  const thisWeekVisits = new Map<string, number>()
  const thisWeekMinutes = new Map<string, number>()
  for (const r of thisWeekRows) {
    thisWeekVisits.set(r.volunteerId, (thisWeekVisits.get(r.volunteerId) ?? 0) + 1)
    thisWeekMinutes.set(r.volunteerId, (thisWeekMinutes.get(r.volunteerId) ?? 0) + (r.durationMins ?? 0))
  }
  const prevWeekIds = new Set(prevRows.map((r) => r.volunteerId))
  const yearAgoIds = new Set(yearAgoRows.map((r) => r.volunteerId))

  const recent4 = new Map<string, number>()
  const previous4 = new Map<string, number>()
  for (const r of trendRows) {
    const bucket = r.signInAt >= trendMid ? recent4 : previous4
    bucket.set(r.volunteerId, (bucket.get(r.volunteerId) ?? 0) + 1)
  }

  const feedbackByVolunteer = new Map<string, typeof feedback>()
  for (const f of feedback) {
    const list = feedbackByVolunteer.get(f.volunteerId) ?? []
    list.push(f)
    feedbackByVolunteer.set(f.volunteerId, list)
  }

  const weekLabel = `${dayLabel(weekStart)} – ${dayLabel(new Date(weekEnd.getTime() - 1))}`

  return (['Loganholme', 'Hillcrest'] as StoreLocation[]).map((store) => {
    const mine = roster.filter((v) => homeStore(v.preferredLocations) === store)
    const name = (v: (typeof roster)[number]) => `${v.firstName} ${v.lastName}`.trim()

    const digest: VolunteerDigest = {
      store,
      weekLabel,
      weekStart,
      weekEnd,
      volunteersThisWeek: 0,
      volunteersLastWeek: 0,
      volunteersSameWeekLastYear: 0,
      visitsThisWeek: 0,
      hoursThisWeek: 0,
      hasLastYearData: yearAgoRows.length > 0,
      active: 0,
      awaitingFirstShift: 0,
      lapsing: 0,
      lapsed: 0,
      onHold: 0,
      pendingInduction: 0,
      rosterTotal: mine.length,
      newThisWeek: [],
      firstShiftThisWeek: [],
      comingMoreOften: [],
      droppedOff: [],
      milestones: [],
      ratingCount: 0,
      averageRating: null,
      comments: [],
      narrative: null,
    }

    let minutes = 0
    let ratingTotal = 0
    const trendingUp: (DigestPerson & { jump: number })[] = []
    const quiet: (DigestPerson & { weeksAway: number; visits: number })[] = []

    for (const v of mine) {
      const l = life.get(v.id)
      const lastAttended = l?._max.signInAt ?? null
      const visits = l?._count._all ?? 0
      const camethisWeek = thisWeekVisits.get(v.id) ?? 0

      // ── The three headline counts ──
      if (camethisWeek > 0) {
        digest.volunteersThisWeek++
        digest.visitsThisWeek += camethisWeek
        minutes += thisWeekMinutes.get(v.id) ?? 0
      }
      if (prevWeekIds.has(v.id)) digest.volunteersLastWeek++
      if (yearAgoIds.has(v.id)) digest.volunteersSameWeekLastYear++

      // ── Roster buckets, in priority order so every volunteer lands in
      //    exactly one and the six counts sum to the roster total. A break or
      //    an admin hold is checked before attendance — someone on leave isn't
      //    "active" just because they were in a fortnight ago, and they're
      //    certainly not lapsing.
      const weeksAway = lastAttended ? weeksBetween(lastAttended, weekEnd) : null
      const onHold = v.status === 'ON_LEAVE' || v.status === 'SUSPENDED'
      if (v.status === 'PENDING_INDUCTION') digest.pendingInduction++
      else if (onHold) digest.onHold++
      else if (weeksAway !== null && weeksAway < ACTIVE_WEEKS) digest.active++
      else if (weeksAway === null)
        weeksBetween(v.joinedAt, weekEnd) < ACTIVE_WEEKS ? digest.awaitingFirstShift++ : digest.lapsed++
      else if (weeksAway < LAPSED_WEEKS) digest.lapsing++
      else digest.lapsed++

      // ── Named lists ──
      if (v.joinedAt >= weekStart && v.joinedAt < weekEnd) {
        digest.newThisWeek.push({ name: name(v), detail: 'signed up this week' })
      }
      if (camethisWeek > 0 && visits === camethisWeek) {
        digest.firstShiftThisWeek.push({ name: name(v), detail: 'first shift' })
      }

      const r4 = recent4.get(v.id) ?? 0
      const p4 = previous4.get(v.id) ?? 0
      if (r4 >= 3 && r4 >= p4 + 2) {
        trendingUp.push({
          name: name(v),
          detail: `${r4} shift${r4 === 1 ? '' : 's'} in the last month, up from ${p4}`,
          jump: r4 - p4,
        })
      }

      // Former regulars who've gone quiet but aren't formally on a break —
      // the ones where a text this week still makes a difference.
      if (
        !onHold &&
        v.status !== 'PENDING_INDUCTION' &&
        weeksAway !== null &&
        weeksAway >= 3 &&
        weeksAway < LAPSED_WEEKS &&
        visits >= REGULAR_VISITS
      ) {
        quiet.push({
          name: name(v),
          detail: `${weeksAway} weeks since their last shift, ${visits} shifts all up`,
          weeksAway,
          visits,
        })
      }

      // ── Hour milestones crossed during the week ──
      if (camethisWeek > 0) {
        const totalMins = l?._sum.durationMins ?? 0
        const beforeMins = totalMins - (thisWeekMinutes.get(v.id) ?? 0)
        const crossed = HOUR_MILESTONES.filter((m) => beforeMins < m * 60 && totalMins >= m * 60)
        const top = crossed[crossed.length - 1]
        if (top) digest.milestones.push({ name: name(v), detail: `passed ${top} hours` })
      }

      // ── Feedback ──
      for (const f of feedbackByVolunteer.get(v.id) ?? []) {
        if (f.rating != null) {
          digest.ratingCount++
          ratingTotal += f.rating
        }
        const comment = f.comment?.trim()
        if (comment) digest.comments.push({ name: name(v), rating: f.rating, comment })
      }
    }

    digest.hoursThisWeek = Math.round(minutes / 60)
    digest.averageRating = digest.ratingCount > 0 ? Number((ratingTotal / digest.ratingCount).toFixed(1)) : null

    // Biggest jumps first, and the longest-quiet regulars first — the aim is a
    // list short enough that a coordinator actually reads all of it.
    trendingUp.sort((a, b) => b.jump - a.jump || a.name.localeCompare(b.name))
    quiet.sort((a, b) => b.weeksAway - a.weeksAway || b.visits - a.visits)
    digest.comingMoreOften = trendingUp.slice(0, 5).map(({ name, detail }) => ({ name, detail }))
    digest.droppedOff = quiet.slice(0, 6).map(({ name, detail }) => ({ name, detail }))
    digest.comments.splice(6)

    return digest
  })
}
