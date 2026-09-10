/**
 * Reading the sales and marketing numbers.
 *
 * Everything is aggregated from the daily grain in SalesFact, so the day, week,
 * month and year views are the same figures summed differently and cannot drift
 * apart. Periods are Brisbane calendar periods, not rolling windows: a manager
 * asking "how did this month go" means the month, and comparing to a rolling
 * 30 days would quietly answer a different question.
 *
 * Every figure comes with the previous equivalent period, because a number on
 * its own tells you nothing — $18,400 is good or bad only next to last month.
 */

import prisma from '@/lib/prisma'
import type { SalesChannel, SocialPlatform, SocialKind } from '@prisma/client'

const BNE = 'Australia/Brisbane'

export type Period = 'day' | 'week' | 'month' | 'year'

export type Range = { from: Date; to: Date; label: string }

/** Brisbane's current date parts, so periods start where the calendar does. */
function brisbaneParts(now = new Date()): { y: number; m: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BNE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    weekday: days.indexOf(String(parts.weekday)),
  }
}

/** A date at Brisbane midnight, expressed as the UTC instant Postgres stores. */
function bneDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d))
}

function fmtRange(from: Date, to: Date, period: Period): string {
  const d = (x: Date) =>
    new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(x)
  if (period === 'day') {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(from)
  }
  if (period === 'month') {
    return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(from)
  }
  if (period === 'year') return String(from.getUTCFullYear())
  return `${d(from)} – ${d(to)}`
}

/** The current period, and the one before it for comparison. */
export function periodRange(period: Period, now = new Date()): { current: Range; previous: Range } {
  const { y, m, d, weekday } = brisbaneParts(now)
  const today = bneDate(y, m, d)

  let from: Date
  let to: Date
  let prevFrom: Date
  let prevTo: Date

  if (period === 'day') {
    from = to = today
    prevFrom = prevTo = new Date(today.getTime() - 86_400_000)
  } else if (period === 'week') {
    // Weeks start Monday, which is how a roster and a trading week both run.
    const backToMonday = (weekday + 6) % 7
    from = new Date(today.getTime() - backToMonday * 86_400_000)
    to = new Date(from.getTime() + 6 * 86_400_000)
    prevFrom = new Date(from.getTime() - 7 * 86_400_000)
    prevTo = new Date(from.getTime() - 86_400_000)
  } else if (period === 'month') {
    from = bneDate(y, m, 1)
    to = new Date(Date.UTC(y, m, 0)) // day 0 of next month = last of this
    prevFrom = bneDate(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 1)
    prevTo = new Date(Date.UTC(y, m - 1, 0))
  } else {
    from = bneDate(y, 1, 1)
    to = bneDate(y, 12, 31)
    prevFrom = bneDate(y - 1, 1, 1)
    prevTo = bneDate(y - 1, 12, 31)
  }

  return {
    current: { from, to, label: fmtRange(from, to, period) },
    previous: { from: prevFrom, to: prevTo, label: fmtRange(prevFrom, prevTo, period) },
  }
}

export type ChannelTotal = {
  channel: SalesChannel
  orders: number
  revenueCents: number
}

export type StoreTotals = {
  store: string
  channels: ChannelTotal[]
  orders: number
  revenueCents: number
}

export type SalesReport = {
  range: Range
  stores: StoreTotals[]
  orders: number
  revenueCents: number
  /** Same figures for the period before, for the up-or-down comparison. */
  previous: { orders: number; revenueCents: number; label: string }
  /** Latest day we hold data for, per source, so the page can be honest. */
  freshness: { source: string; latestDay: Date | null }[]
}

export async function getSalesReport(period: Period, now = new Date()): Promise<SalesReport> {
  const { current, previous } = periodRange(period, now)

  const [rows, prevRows, sources] = await Promise.all([
    prisma.salesFact.groupBy({
      by: ['store', 'channel'],
      where: { day: { gte: current.from, lte: current.to } },
      _sum: { orders: true, revenueCents: true },
    }),
    prisma.salesFact.aggregate({
      where: { day: { gte: previous.from, lte: previous.to } },
      _sum: { orders: true, revenueCents: true },
    }),
    prisma.salesFact.groupBy({ by: ['source'], _max: { day: true } }),
  ])

  const byStore = new Map<string, StoreTotals>()
  for (const r of rows) {
    const entry = byStore.get(r.store) ?? { store: r.store, channels: [], orders: 0, revenueCents: 0 }
    const orders = r._sum.orders ?? 0
    const revenueCents = r._sum.revenueCents ?? 0
    entry.channels.push({ channel: r.channel, orders, revenueCents })
    entry.orders += orders
    entry.revenueCents += revenueCents
    byStore.set(r.store, entry)
  }

  const stores = [...byStore.values()].sort((a, b) => a.store.localeCompare(b.store))

  return {
    range: current,
    stores,
    orders: stores.reduce((n, s) => n + s.orders, 0),
    revenueCents: stores.reduce((n, s) => n + s.revenueCents, 0),
    previous: {
      orders: prevRows._sum.orders ?? 0,
      revenueCents: prevRows._sum.revenueCents ?? 0,
      label: previous.label,
    },
    freshness: sources.map((s) => ({ source: s.source, latestDay: s._max.day })),
  }
}

export type TopPost = {
  id: string
  platform: SocialPlatform
  kind: SocialKind
  caption: string | null
  permalink: string | null
  thumbnailUrl: string | null
  publishedAt: Date
  views: number
  engagements: number
  clicks: number
  spendCents: number
  audience: string | null
  /** Engagements as a share of views — comparable across platforms. */
  engagementRate: number
}

function rate(engagements: number, views: number): number {
  return views === 0 ? 0 : (engagements / views) * 100
}

/**
 * Best content in the period.
 *
 * Three lists, not one, because the numbers are not comparable across them:
 *
 *  - Paid comes from AdDayStat, summed over the days in the period. An ad
 *    created in July can be September's biggest spender, so filtering it by a
 *    publish date would answer the wrong question — which is exactly why the
 *    day-grain table exists.
 *  - Organic social is filtered by publish date, which is correct for a post.
 *  - Email is kept separate. An open rate of 10% and a post engagement rate of
 *    2% are different measurements of different things, and ranking them in one
 *    list would put every campaign above every post for no real reason.
 */
export async function getTopSocial(
  period: Period,
  now = new Date(),
  take = 5,
): Promise<{
  range: Range
  organic: TopPost[]
  paid: TopPost[]
  email: TopPost[]
  platforms: SocialPlatform[]
}> {
  const { current } = periodRange(period, now)
  const endOfDay = new Date(current.to.getTime() + 86_399_999)

  const [posts, adDays] = await Promise.all([
    prisma.socialPost.findMany({
      where: { publishedAt: { gte: current.from, lte: endOfDay } },
      select: {
        id: true,
        platform: true,
        kind: true,
        externalId: true,
        caption: true,
        permalink: true,
        thumbnailUrl: true,
        publishedAt: true,
        views: true,
        engagements: true,
        clicks: true,
        spendCents: true,
        audience: true,
      },
    }),
    // Paid performance for the days in this period, whenever the ad was made.
    prisma.adDayStat.groupBy({
      by: ['platform', 'externalId'],
      where: { day: { gte: current.from, lte: current.to } },
      _sum: { views: true, clicks: true, spendCents: true },
    }),
  ])

  const shape = (r: (typeof posts)[number], over?: { views: number; clicks: number; spendCents: number }): TopPost => {
    const views = over?.views ?? r.views
    return {
      id: r.id,
      platform: r.platform,
      kind: r.kind,
      caption: r.caption,
      permalink: r.permalink,
      thumbnailUrl: r.thumbnailUrl,
      publishedAt: r.publishedAt,
      views,
      engagements: r.engagements,
      clicks: over?.clicks ?? r.clicks,
      spendCents: over?.spendCents ?? r.spendCents,
      audience: r.audience,
      engagementRate: rate(r.engagements, views),
    }
  }

  // Ad metadata lives on SocialPost; the numbers come from AdDayStat. Look the
  // metadata up separately, since an ad spending this month may have been
  // created outside the period and so is not in `posts`.
  const adIds = adDays.map((a) => a.externalId)
  const adMeta = adIds.length
    ? await prisma.socialPost.findMany({
        where: { kind: 'PAID', externalId: { in: adIds } },
        select: {
          id: true, platform: true, kind: true, externalId: true, caption: true,
          permalink: true, thumbnailUrl: true, publishedAt: true, views: true,
          engagements: true, clicks: true, spendCents: true, audience: true,
        },
      })
    : []
  const metaById = new Map(adMeta.map((m) => [m.externalId, m]))

  const paid = adDays
    .map((a) => {
      const meta = metaById.get(a.externalId)
      if (!meta) return null
      return shape(meta, {
        views: a._sum.views ?? 0,
        clicks: a._sum.clicks ?? 0,
        spendCents: a._sum.spendCents ?? 0,
      })
    })
    .filter((x): x is TopPost => x !== null)
    // Spend is the honest ranking for paid: it is what you chose to put behind
    // it, and engagement rate on an ad mostly reflects budget.
    .sort((a, b) => b.spendCents - a.spendCents)
    .slice(0, take)

  // Ranked by views, not engagement rate.
  //
  // Rate put a post seen by thirty people above one seen by twenty thousand,
  // because ten of the thirty liked it. That is a real signal but it is not
  // what "top posts" means to anyone reading the page — and since views is
  // the first figure on each row, a list ordered by something else simply
  // looks broken. Rate stays visible as the tiebreak and as a column.
  const byViews = (a: TopPost, b: TopPost) =>
    b.views - a.views || b.engagements - a.engagements || b.engagementRate - a.engagementRate

  const organic = posts
    .filter((p) => p.kind === 'ORGANIC' && p.platform !== 'MAILCHIMP')
    .map((p) => shape(p))
    .sort(byViews)
    .slice(0, take)

  const email = posts
    .filter((p) => p.platform === 'MAILCHIMP')
    .map((p) => shape(p))
    .sort(byViews)
    .slice(0, take)

  return {
    range: current,
    organic,
    paid,
    email,
    platforms: [...new Set(posts.map((p) => p.platform))],
  }
}

/** Last successful pull per source, so each panel can show its own age. */
// ─── Sales against exposure, over time ────────────────────────────────────────

export type TrendPoint = {
  /** Short label for the axis: "8 Sep" or "Sep". */
  label: string
  /** Full label for the tooltip. */
  title: string
  revenueCents: number
  views: number
}

/**
 * Takings and eyeballs, bucket by bucket.
 *
 * Deliberately built from the same sources as the exposure panel — ad views,
 * organic post views and email opens — so the two can never disagree about
 * what a "view" is. One definition, read twice.
 *
 * Weeks run Monday to Sunday, matching every other week in this app. Months
 * are calendar months in Brisbane.
 */
export async function getSalesVsViews(
  grain: 'week' | 'month',
  points = 12,
  now = new Date(),
): Promise<TrendPoint[]> {
  const { y, m, d, weekday } = brisbaneParts(now)

  // Bucket starts, oldest first.
  const starts: Date[] = []
  if (grain === 'week') {
    const today = bneDate(y, m, d)
    const thisMonday = new Date(today.getTime() - ((weekday + 6) % 7) * 86_400_000)
    for (let i = points - 1; i >= 0; i--) {
      starts.push(new Date(thisMonday.getTime() - i * 7 * 86_400_000))
    }
  } else {
    for (let i = points - 1; i >= 0; i--) {
      const month = m - i
      const year = y + Math.floor((month - 1) / 12)
      const norm = ((month - 1) % 12 + 12) % 12 + 1
      starts.push(bneDate(year, norm, 1))
    }
  }

  const endOf = (start: Date, i: number): Date => {
    if (grain === 'week') return new Date(start.getTime() + 6 * 86_400_000)
    const next = starts[i + 1]
    if (next) return new Date(next.getTime() - 86_400_000)
    const sy = start.getUTCFullYear()
    const sm = start.getUTCMonth() + 1
    return new Date(Date.UTC(sm === 12 ? sy + 1 : sy, sm === 12 ? 0 : sm, 0))
  }

  const from = starts[0]
  const to = endOf(starts[starts.length - 1], starts.length - 1)
  const endInstant = new Date(to.getTime() + 86_399_999)

  const [sales, ads, organic, email] = await Promise.all([
    prisma.salesFact.groupBy({
      by: ['day'],
      where: { day: { gte: from, lte: to } },
      _sum: { revenueCents: true },
    }),
    prisma.adDayStat.groupBy({
      by: ['day'],
      where: { day: { gte: from, lte: to } },
      _sum: { views: true },
    }),
    prisma.socialPost.findMany({
      where: {
        kind: 'ORGANIC',
        platform: { in: ['FACEBOOK', 'INSTAGRAM'] },
        publishedAt: { gte: from, lte: endInstant },
      },
      select: { publishedAt: true, views: true },
    }),
    // Opens, not sends — the same choice the exposure panel makes.
    prisma.socialPost.findMany({
      where: { platform: 'MAILCHIMP', publishedAt: { gte: from, lte: endInstant } },
      select: { publishedAt: true, engagements: true },
    }),
  ])

  const buckets = starts.map((start, i) => {
    const end = endOf(start, i)
    return { start, end, revenueCents: 0, views: 0 }
  })

  const put = (at: Date | null, revenue: number, views: number) => {
    if (!at) return
    const t = at.getTime()
    for (const b of buckets) {
      if (t >= b.start.getTime() && t <= b.end.getTime() + 86_399_999) {
        b.revenueCents += revenue
        b.views += views
        return
      }
    }
  }

  for (const r of sales) put(r.day, r._sum.revenueCents ?? 0, 0)
  for (const r of ads) put(r.day, 0, r._sum.views ?? 0)
  for (const r of organic) put(r.publishedAt, 0, r.views)
  for (const r of email) put(r.publishedAt, 0, r.engagements)

  const short = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
  const monthOnly = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'short' })

  return buckets.map((b) => ({
    label: grain === 'week' ? short.format(b.start) : monthOnly.format(b.start),
    title:
      grain === 'week'
        ? `${short.format(b.start)} – ${short.format(b.end)}`
        : new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(b.start),
    revenueCents: b.revenueCents,
    views: b.views,
  }))
}

export async function getIngestHealth(): Promise<
  { source: string; at: Date | null; ok: boolean; error: string | null }[]
> {
  const runs = await prisma.ingestRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: { source: true, startedAt: true, ok: true, error: true },
  })
  const seen = new Map<string, { source: string; at: Date | null; ok: boolean; error: string | null }>()
  for (const r of runs) {
    if (!seen.has(r.source)) {
      seen.set(r.source, { source: r.source, at: r.startedAt, ok: r.ok, error: r.error })
    }
  }
  return [...seen.values()]
}


export type ExposureSource = {
  label: string
  views: number
  /** True where the figure is a genuine per-day measurement. */
  exact: boolean
}

export type Exposure = {
  range: Range
  total: number
  previousTotal: number
  previousLabel: string
  sources: ExposureSource[]
}

/**
 * How much content exposure a period produced.
 *
 * A deliberately blunt instrument, and worth understanding before anyone quotes
 * it. Three caveats, all of which the page states plainly:
 *
 *  1. Paid and organic overlap. A boosted post is counted by both its own
 *     insights and the ad's, so the total is higher than the true number of
 *     showings. Meta gives no way to net this off per post.
 *  2. Views are showings, not people. One person passing four posts is four.
 *     Reach is the unique measure, but Facebook retired per-post reach, so it
 *     is only available for Instagram and ads.
 *  3. Ad views are measured per day and are exact for the period. Organic and
 *     email are attributed to the day the content went out, and keep accruing
 *     afterwards — so a post published on the last day of a period is
 *     under-counted in it.
 *
 * What survives all that is the comparison. The biases are the same every week,
 * so the direction and size of the change are meaningful even though the
 * absolute figure is not a headcount.
 */
export async function getExposure(period: Period, now = new Date()): Promise<Exposure> {
  const { current, previous } = periodRange(period, now)
  const end = (r: Range) => new Date(r.to.getTime() + 86_399_999)

  const [paidNow, paidBefore, organicNow, organicBefore, mailNow, mailBefore] = await Promise.all([
    prisma.adDayStat.aggregate({
      where: { day: { gte: current.from, lte: current.to } },
      _sum: { views: true },
    }),
    prisma.adDayStat.aggregate({
      where: { day: { gte: previous.from, lte: previous.to } },
      _sum: { views: true },
    }),
    prisma.socialPost.aggregate({
      where: {
        kind: 'ORGANIC',
        platform: { in: ['FACEBOOK', 'INSTAGRAM'] },
        publishedAt: { gte: current.from, lte: end(current) },
      },
      _sum: { views: true },
    }),
    prisma.socialPost.aggregate({
      where: {
        kind: 'ORGANIC',
        platform: { in: ['FACEBOOK', 'INSTAGRAM'] },
        publishedAt: { gte: previous.from, lte: end(previous) },
      },
      _sum: { views: true },
    }),
    // Opens, not sends: an unopened email reached nobody.
    prisma.socialPost.aggregate({
      where: { platform: 'MAILCHIMP', publishedAt: { gte: current.from, lte: end(current) } },
      _sum: { engagements: true },
    }),
    prisma.socialPost.aggregate({
      where: { platform: 'MAILCHIMP', publishedAt: { gte: previous.from, lte: end(previous) } },
      _sum: { engagements: true },
    }),
  ])

  const paid = paidNow._sum.views ?? 0
  const organic = organicNow._sum.views ?? 0
  const email = mailNow._sum.engagements ?? 0

  return {
    range: current,
    total: paid + organic + email,
    previousTotal:
      (paidBefore._sum.views ?? 0) +
      (organicBefore._sum.views ?? 0) +
      (mailBefore._sum.engagements ?? 0),
    previousLabel: previous.label,
    sources: [
      { label: 'Paid ads', views: paid, exact: true },
      { label: 'Organic posts', views: organic, exact: false },
      { label: 'Email opens', views: email, exact: false },
    ],
  }
}
