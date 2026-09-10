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
import type { ViewSource } from '@/lib/view-sources'
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

  // Email ranks on opens, not on views.
  //
  // For a Mailchimp campaign, SocialPost.views holds emails_sent — the size of
  // the list. Every campaign goes to the same list, so those figures land
  // within a dozen of each other and ranking by them is very nearly random.
  // Opens are the figure that differs, and the one that means anything: an
  // unopened email reached nobody. `views` is left as sent, because
  // opens ÷ sent is the open rate and that is worth keeping.
  const email = posts
    .filter((p) => p.platform === 'MAILCHIMP')
    .map((p) => shape(p))
    .sort((a, b) => b.engagements - a.engagements || b.clicks - a.clicks)
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

export type TrendDay = {
  /** yyyy-mm-dd, Brisbane. */
  day: string
  /**
   * Revenue by "Store|CHANNEL". Compact on purpose — this is a year of days
   * crossing the wire, and zeros are omitted rather than sent.
   */
  sales: Record<string, number>
  /**
   * Views by source, so each can be included or excluded.
   *
   * Organisation-wide, all of them. Meta and Mailchimp do not know which shop
   * an impression belonged to, so views cannot be split by store — which the
   * chart says out loud rather than implying a split that does not exist.
   *
   * MAILCHIMP counts **opens**, never the size of the list. An email sent to
   * forty thousand people and opened by two thousand reached two thousand.
   */
  views: Partial<Record<ViewSource, number>>
}

/**
 * A year of days, sales and views together.
 *
 * Days rather than weeks or months because the grain belongs to the reader,
 * not to this function. Sending the daily grain once lets the chart offer
 * days, weeks and months and switch between them instantly — where fetching
 * per grain meant the page had to guess which one you wanted, and guessed
 * wrong often enough to be annoying.
 *
 * Views come from the same three sources as the exposure panel — ad views,
 * organic post views, email opens — so the two can never disagree about what
 * a view is.
 */
export async function getDailyTrend(days = 365, now = new Date()): Promise<TrendDay[]> {
  const { y, m, d } = brisbaneParts(now)
  const today = bneDate(y, m, d)
  const from = new Date(today.getTime() - (days - 1) * 86_400_000)
  const endInstant = new Date(today.getTime() + 86_399_999)

  const [sales, ads, organic, email] = await Promise.all([
    prisma.salesFact.groupBy({
      by: ['day', 'store', 'channel'],
      where: { day: { gte: from, lte: today } },
      _sum: { revenueCents: true },
    }),
    prisma.adDayStat.groupBy({
      by: ['day'],
      where: { day: { gte: from, lte: today } },
      _sum: { views: true },
    }),
    prisma.socialPost.findMany({
      where: {
        kind: 'ORGANIC',
        platform: { in: ['FACEBOOK', 'INSTAGRAM', 'TIKTOK'] },
        publishedAt: { gte: from, lte: endInstant },
      },
      select: { publishedAt: true, views: true, platform: true },
    }),
    // Opens, not sends — the same choice the exposure panel makes.
    prisma.socialPost.findMany({
      where: { platform: 'MAILCHIMP', publishedAt: { gte: from, lte: endInstant } },
      select: { publishedAt: true, engagements: true },
    }),
  ])

  const byDay = new Map<string, TrendDay>()
  for (let i = 0; i < days; i++) {
    const key = new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10)
    byDay.set(key, { day: key, sales: {}, views: {} })
  }

  const addView = (dayKey: string, source: ViewSource, n: number) => {
    if (n === 0) return
    const bucket = byDay.get(dayKey)
    if (!bucket) return
    bucket.views[source] = (bucket.views[source] ?? 0) + n
  }

  for (const r of sales) {
    const bucket = byDay.get(r.day.toISOString().slice(0, 10))
    if (!bucket) continue
    const cents = r._sum.revenueCents ?? 0
    if (cents === 0) continue
    const key = `${r.store}|${r.channel}`
    bucket.sales[key] = (bucket.sales[key] ?? 0) + cents
  }
  for (const r of ads) addView(r.day.toISOString().slice(0, 10), 'ADS', r._sum.views ?? 0)
  // Published instants are UTC; the day they belong to is Brisbane's.
  const bneDay = (at: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Brisbane',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at)
  for (const r of organic) addView(bneDay(r.publishedAt), r.platform as ViewSource, r.views)
  // Opens, never emails_sent: SocialPost.views holds the size of the list for
  // a campaign, which is not a measure of anyone having seen it.
  for (const r of email) addView(bneDay(r.publishedAt), 'MAILCHIMP', r.engagements)

  return [...byDay.values()]
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
