/**
 * What the marketing assistant is allowed to know.
 *
 * Every tool here reads aggregates: takings by day, store and channel, post
 * and ad performance, campaign totals. None of them can return a customer, a
 * donor, a volunteer or an email address — not because the prompt asks them
 * not to, but because no query in this file selects a person. That distinction
 * matters: a prompt is a request, and a query is a fact.
 *
 * It is the tool surface, not the system prompt, that decides what leaves the
 * building. Tool results are sent to the Anthropic API, so this file is the
 * list of what we are willing to send. Read it that way before adding to it.
 */

import prisma from '@/lib/prisma'
import {
  getSalesReport,
  getTopSocial,
  getDailyTrend,
  getExposure,
  getIngestHealth,
  type Period,
} from '@/lib/business-reports'
import { listAdSets, listAds } from '@/lib/integrations/meta-write'
import { listMedia } from '@/lib/media-library'

const PERIODS: Period[] = ['day', 'week', 'month', 'year']
const asPeriod = (v: unknown): Period =>
  PERIODS.includes(v as Period) ? (v as Period) : 'week'

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

/** A tool's answer, as a string, because that is what the model reads. */
export type ToolResult = string

// ─── Sales ────────────────────────────────────────────────────────────────────

async function salesSummary(input: { period?: string }): Promise<ToolResult> {
  const period = asPeriod(input.period)
  const r = await getSalesReport(period)

  const pct =
    r.previous.revenueCents > 0
      ? `${r.revenueCents >= r.previous.revenueCents ? '+' : ''}${Math.round(((r.revenueCents - r.previous.revenueCents) / r.previous.revenueCents) * 100)}%`
      : 'no comparison'

  const lines: string[] = [`Sales for ${r.range.label}:`]
  for (const store of r.stores) {
    lines.push(`\n${store.store} — ${money(store.revenueCents)} from ${store.orders} orders`)
    for (const ch of store.channels) {
      lines.push(`  ${ch.channel}: ${money(ch.revenueCents)} from ${ch.orders} orders`)
    }
  }
  lines.push(
    `\nTotal ${money(r.revenueCents)} from ${r.orders} orders.`,
    `Previous period (${r.previous.label}): ${money(r.previous.revenueCents)} from ${r.previous.orders} orders — ${pct}.`,
    `Average order ${money(r.orders ? Math.round(r.revenueCents / r.orders) : 0)}.`,
  )

  const stale = r.freshness.filter((f) => !f.latestDay)
  if (stale.length > 0) {
    lines.push(`\nNo data at all from: ${stale.map((f) => f.source).join(', ')}.`)
  }
  return lines.join('\n')
}

async function dailySales(input: { days?: number }): Promise<ToolResult> {
  const days = Math.min(Math.max(Number(input.days) || 28, 1), 365)
  const trend = await getDailyTrend(days)

  const rows = trend.map((d) => {
    const sales = Object.values(d.sales).reduce((n, c) => n + c, 0)
    const views = Object.values(d.views).reduce((n, v) => n + (v ?? 0), 0)
    return `${d.day}  sales ${money(sales)}  views ${views}`
  })
  return `Day by day, oldest first (${days} days):\n${rows.join('\n')}`
}

// ─── Social and ads ───────────────────────────────────────────────────────────

async function topPosts(input: { period?: string; kind?: string }): Promise<ToolResult> {
  const period = asPeriod(input.period)
  const kind = input.kind === 'paid' ? 'paid' : input.kind === 'email' ? 'email' : 'organic'
  const top = await getTopSocial(period, new Date(), 10)

  const describe = (p: {
    externalId: string
    platform: string
    views: number
    engagements: number
    clicks: number
    spendCents: number
    conversions: number
    conversionValueCents: number
    caption: string | null
    engagementRate: number
    publishedAt: Date
  }) => {
    const bits = [
      p.platform,
      `${p.views} views`,
      p.engagements ? `${p.engagements} engagements (${p.engagementRate.toFixed(1)}%)` : null,
      p.clicks ? `${p.clicks} clicks` : null,
      p.spendCents ? `spend ${money(p.spendCents)}` : null,
      p.conversions ? `${p.conversions} results` : null,
      p.conversionValueCents ? `worth ${money(p.conversionValueCents)}` : null,
      p.spendCents && p.conversionValueCents
        ? `ROAS ${(p.conversionValueCents / p.spendCents).toFixed(2)}x`
        : null,
    ].filter(Boolean)
    const caption = p.caption ? ` — "${p.caption.replace(/\s+/g, ' ').slice(0, 140)}"` : ''
    // The id is here so a post that is doing well organically can be boosted
    // by name rather than described back at us.
    return `[post ${p.externalId}] ${p.publishedAt.toISOString().slice(0, 10)}: ${bits.join(', ')}${caption}`
  }

  if (kind === 'paid') {
    if (top.paid.length === 0) return `No paid ads ran in ${top.range.label}.`
    return [
      `Paid ads in ${top.range.label}, best first. Spend and results are summed over the days in the period, not the day the ad was made:`,
      ...top.paid.map((p, i) => `${i + 1}. ${describe(p)}`),
    ].join('\n')
  }

  if (kind === 'email') {
    if (top.email.length === 0) return `No email campaigns in ${top.range.label}.`
    return [
      `Email campaigns in ${top.range.label}. "views" here is opens, not sends:`,
      ...top.email.map((p, i) => `${i + 1}. ${describe(p)}${p.audience ? ` [${p.audience}]` : ''}`),
    ].join('\n')
  }

  if (top.organicByPlatform.length === 0) return `No organic posts in ${top.range.label}.`
  return [
    `Organic posts in ${top.range.label}, grouped by platform because the counts are not comparable across them:`,
    ...top.organicByPlatform.flatMap((g) => [
      `\n${g.platform}:`,
      ...g.posts.map((p, i) => `  ${i + 1}. ${describe(p)}`),
    ]),
  ].join('\n')
}

async function reachByChannel(input: { period?: string }): Promise<ToolResult> {
  const period = asPeriod(input.period)
  const e = await getExposure(period)
  const pct =
    e.previousTotal > 0
      ? `${e.total >= e.previousTotal ? '+' : ''}${Math.round(((e.total - e.previousTotal) / e.previousTotal) * 100)}%`
      : 'no comparison'

  return [
    `Views by source for ${e.range.label}:`,
    ...e.sources.map(
      (s) => `${s.label}: ${s.views}${s.exact ? '' : ' (attributed to the publish day, still accruing)'}`,
    ),
    `Total ${e.total} views, against ${e.previousTotal} in ${e.previousLabel} — ${pct}.`,
    'Caveat worth repeating in any answer that leans on this: paid and organic overlap, because a boosted post is counted by both. The change between periods is meaningful; the absolute figure is not a headcount.',
  ].join('\n')
}

/**
 * Mailchimp campaign performance.
 *
 * Audience *names* only, never a subscriber. `views` on a Mailchimp row is
 * opens rather than sends — the distinction is documented in view-sources.ts
 * and repeated here because a model reading "views" would otherwise assume
 * the list size.
 */
async function emailCampaigns(input: { days?: number }): Promise<ToolResult> {
  const days = Math.min(Math.max(Number(input.days) || 90, 1), 400)
  const since = new Date(Date.now() - days * 86_400_000)

  const rows = await prisma.socialPost.findMany({
    where: { platform: 'MAILCHIMP', publishedAt: { gt: since } },
    orderBy: { publishedAt: 'desc' },
    take: 25,
    select: {
      publishedAt: true,
      caption: true,
      audience: true,
      views: true,
      clicks: true,
      engagements: true,
    },
  })
  if (rows.length === 0) return `No email campaigns in the last ${days} days.`

  return [
    `Email campaigns, last ${days} days. "opens" is how many people opened it, not how many it was sent to:`,
    ...rows.map(
      (r) =>
        `${r.publishedAt.toISOString().slice(0, 10)} — "${(r.caption ?? 'untitled').slice(0, 80)}"${
          r.audience ? ` (${r.audience})` : ''
        }: ${r.views} opens, ${r.clicks} clicks`,
    ),
  ].join('\n')
}

async function adSets(): Promise<ToolResult> {
  const sets = await listAdSets()
  if (sets.length === 0) return 'No ad sets on the account.'
  return [
    'Ad sets as they stand now. Use the id exactly when proposing a change:',
    ...sets.map(
      (a) =>
        `${a.id} — "${a.name}"${a.campaignName ? ` in campaign "${a.campaignName}"` : ''}: ${a.status}, daily budget ${
          a.dailyBudgetCents === null ? 'set at campaign level' : money(a.dailyBudgetCents)
        }`,
    ),
  ].join('\n')
}

async function liveAds(): Promise<ToolResult> {
  const ads = await listAds(50)
  if (ads.length === 0) return 'No ads on the account.'
  const running = ads.filter((a) => a.effectiveStatus === 'ACTIVE')
  const stopped = ads.filter((a) => a.effectiveStatus !== 'ACTIVE')
  const line = (a: (typeof ads)[number]) =>
    `${a.id} — "${a.name}"${a.adSetName ? ` in "${a.adSetName}"` : ''}: ${a.effectiveStatus}${
      a.issues.length ? ` — Meta says: ${a.issues.join('; ')}` : ''
    }`
  return [
    `${running.length} running, ${stopped.length} not.`,
    '',
    'Running:',
    ...(running.length ? running.map(line) : ['  none']),
    '',
    'Not running (paused, finished, or refused by Meta):',
    ...(stopped.length ? stopped.slice(0, 20).map(line) : ['  none']),
  ].join('\n')
}

async function feedHealth(): Promise<ToolResult> {
  const health = await getIngestHealth()
  return [
    'When each feed last finished, and whether it worked. Check this before calling a number low — it may never have been fetched:',
    ...health.map((h) => {
      const when = h.at ? h.at.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'never'
      return `${h.source}: ${h.ok ? 'ok' : 'FAILED'}, last finished ${when}${
        h.interrupted ? ' (a later run started and never finished)' : ''
      }${h.error ? ` — ${h.error.slice(0, 200)}` : ''}`
    }),
  ].join('\n')
}

// ─── Assets ───────────────────────────────────────────────────────────────────

/**
 * The image library, by name and URL.
 *
 * Claude is not shown the pictures — only what they are called. So a proposal
 * naming an asset is a suggestion based on the filename, and the person
 * approving it sees the actual thumbnail before it goes anywhere. Said out
 * loud in the tool description too, so the model does not claim to have
 * looked at an image it has not seen.
 */
async function listMarketingAssets(): Promise<ToolResult> {
  const media = await listMedia(80)
  if (media.length === 0) {
    return 'The media library is empty. Someone needs to add images before a post or an ad can carry one.'
  }
  return [
    'Images in the library, newest first. You can see the names, not the pictures — do not describe what is in one:',
    ...media.map((m) => `[${m.label}] ${m.name} — ${m.url}`),
  ].join('\n')
}

// ─── The registry ─────────────────────────────────────────────────────────────

type Handler = (input: Record<string, unknown>) => Promise<ToolResult>

export const READ_TOOLS: {
  name: string
  description: string
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
  run: Handler
}[] = [
  {
    name: 'sales_summary',
    description:
      'Takings for a period, split by store (Loganholme, Hillcrest) and channel (in-store, online), against the same period before. Use this first for any question about how sales are going.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: PERIODS, description: 'Defaults to week.' },
      },
    },
    run: (i) => salesSummary(i as { period?: string }),
  },
  {
    name: 'daily_sales_and_views',
    description:
      'Sales and total views day by day, for spotting which days moved and whether marketing lined up with them.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'How many days back, 1 to 365. Defaults to 28.' },
      },
    },
    run: (i) => dailySales(i as { days?: number }),
  },
  {
    name: 'top_posts',
    description:
      'Best performing content in a period. kind "organic", "paid" or "email". Paid rows carry spend, results and ROAS; organic comes grouped by platform.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: PERIODS },
        kind: { type: 'string', enum: ['organic', 'paid', 'email'], description: 'Defaults to organic.' },
      },
    },
    run: (i) => topPosts(i as { period?: string; kind?: string }),
  },
  {
    name: 'reach_by_channel',
    description:
      'Views broken down by where they came from — paid ads, Facebook, Instagram, TikTok, email opens.',
    input_schema: {
      type: 'object',
      properties: { period: { type: 'string', enum: PERIODS } },
    },
    run: (i) => reachByChannel(i as { period?: string }),
  },
  {
    name: 'email_campaigns',
    description:
      'Mailchimp campaigns with opens and clicks. Audience names only — there is no way to see a subscriber.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Defaults to 90.' } },
    },
    run: (i) => emailCampaigns(i as { days?: number }),
  },
  {
    name: 'list_ad_sets',
    description:
      'Live ad sets with their current status and daily budget. Call this before proposing any ad change — you need the real id, and the current value for the before-and-after.',
    input_schema: { type: 'object', properties: {} },
    run: () => adSets(),
  },
  {
    name: 'list_ads',
    description:
      'Every ad and whether it is actually running. Use effective_status, not what someone intended — an ad Meta refused still reads as active on the ad set. Carries Meta\u2019s rejection reasons where there are any.',
    input_schema: { type: 'object', properties: {} },
    run: () => liveAds(),
  },
  {
    name: 'feed_health',
    description:
      'When each data feed last ran and whether it worked. Check this before concluding a number is low — it may not have been fetched.',
    input_schema: { type: 'object', properties: {} },
    run: () => feedHealth(),
  },
  {
    name: 'list_assets',
    description:
      'Every image in the media library — event photos, story photos, anything the team has uploaded — by name and URL. You cannot see the pictures themselves, only their names, so never describe what is in one.',
    input_schema: { type: 'object', properties: {} },
    run: () => listMarketingAssets(),
  },
]
