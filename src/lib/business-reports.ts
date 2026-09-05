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
  /** Engagements as a share of views — comparable across platforms. */
  engagementRate: number
}

function rate(engagements: number, views: number): number {
  return views === 0 ? 0 : (engagements / views) * 100
}

/**
 * Best posts in the period, organic and paid separately.
 *
 * Ranked by engagement rate rather than raw engagements, so a modest post that
 * genuinely landed is not buried under one that merely had budget behind it.
 */
export async function getTopSocial(
  period: Period,
  now = new Date(),
  take = 5,
): Promise<{ range: Range; organic: TopPost[]; paid: TopPost[]; platforms: SocialPlatform[] }> {
  const { current } = periodRange(period, now)

  const rows = await prisma.socialPost.findMany({
    where: { publishedAt: { gte: current.from, lte: new Date(current.to.getTime() + 86_399_999) } },
    select: {
      id: true,
      platform: true,
      kind: true,
      caption: true,
      permalink: true,
      thumbnailUrl: true,
      publishedAt: true,
      views: true,
      engagements: true,
      clicks: true,
      spendCents: true,
    },
  })

  const shaped: TopPost[] = rows.map((r) => ({
    ...r,
    engagementRate: rate(r.engagements, r.views),
  }))

  const best = (kind: SocialKind) =>
    shaped
      .filter((p) => p.kind === kind)
      .sort((a, b) => b.engagementRate - a.engagementRate || b.engagements - a.engagements)
      .slice(0, take)

  return {
    range: current,
    organic: best('ORGANIC'),
    paid: best('PAID'),
    platforms: [...new Set(shaped.map((p) => p.platform))],
  }
}

/** Last successful pull per source, so each panel can show its own age. */
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
