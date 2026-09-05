/**
 * Pulling Facebook, Instagram and Meta ads.
 *
 * Every metric name here was verified against the live account rather than
 * taken from the docs, because Meta retired a lot of them on 15 Nov 2025 and a
 * dead metric fails the whole request rather than returning zero:
 *
 *   post_impressions        → gone, use post_media_view
 *   post_impressions_unique → gone, no per-post reach on Facebook at all
 *   page_impressions        → gone, use page_media_view
 *   page_fans               → gone, use page_follows
 *
 * Instagram dropped `impressions` for `views` separately, in April 2025.
 *
 * Auth is a Business Manager system user token, which does not expire. Page
 * and post insights need a Page token, which is exchanged from it per run
 * rather than stored — one fewer secret to rotate.
 */

import prisma from '@/lib/prisma'
import type { SocialPlatform } from '@prisma/client'

const V = 'v26.0'
const BASE = `https://graph.facebook.com/${V}`

/**
 * How far back to pull ad spend on a normal run.
 *
 * Short on purpose. Figures settle within a few days, the job runs nightly, and
 * history accumulates in AdDayStat — so re-pulling three months every night
 * would be thousands of writes to rediscover numbers we already hold. Pass a
 * bigger window explicitly for a first-time backfill.
 */
const AD_DAYS_DEFAULT = 7
/** How many recent posts to keep metrics fresh for. */
const POST_LIMIT = 50

type Cfg = {
  token: string
  adAccountId: string
  pageId: string
  igUserId: string
}

export function metaConfig(): Cfg | null {
  const token = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  const pageId = process.env.META_PAGE_ID
  const igUserId = process.env.META_IG_USER_ID
  if (!token || !adAccountId || !pageId || !igUserId) return null
  return { token, adAccountId, pageId, igUserId }
}

async function graph<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)

  const res = await fetch(url, { cache: 'no-store' })
  const json = (await res.json()) as T & { error?: { message: string; code: number } }
  if (json.error) {
    throw new Error(`Graph ${path} failed (${json.error.code}): ${json.error.message}`)
  }
  return json
}

/**
 * Follow Meta's paging cursors to the end.
 *
 * Without this a busy account silently truncates at the page size and the
 * numbers are simply wrong — which is worse than missing, because nothing
 * looks broken. The cap is a runaway guard, not an expected limit.
 */
async function graphAll<T>(
  path: string,
  params: Record<string, string>,
  token: string,
  maxPages = 40,
  /** True when maxPages is a deliberate cap rather than a runaway guard. */
  capIsIntentional = false,
): Promise<T[]> {
  const out: T[] = []
  let next: string | null = null
  for (let page = 0; page < maxPages; page++) {
    const res: { data?: T[]; paging?: { next?: string } } = next
      ? await fetch(next, { cache: 'no-store' }).then((r) => r.json())
      : await graph<{ data?: T[]; paging?: { next?: string } }>(path, params, token)
    out.push(...(res.data ?? []))
    next = res.paging?.next ?? null
    if (!next) return out
  }
  if (!capIsIntentional) {
    console.warn(`graphAll(${path}) stopped at the page cap — data may be incomplete`)
  }
  return out
}

const cents = (dollars: string | number | undefined) =>
  Math.round(Number(dollars ?? 0) * 100)

const int = (v: string | number | undefined) => Math.round(Number(v ?? 0))

/** A date-only value, matching how SalesFact stores days. */
function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

/** Sum a Meta "by_action_type" style object, which comes back keyed by action. */
function sumActions(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  return Object.values(value as Record<string, number>).reduce(
    (n, v) => n + (Number(v) || 0),
    0,
  )
}

// ── Paid ─────────────────────────────────────────────────────────────────────

type AdRow = {
  ad_id: string
  ad_name?: string
  spend?: string
  reach?: string
  clicks?: string
  impressions?: string
  date_start: string
}

async function ingestAds(cfg: Cfg, days: number): Promise<number> {
  const until = new Date()
  const since = new Date(until.getTime() - days * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  // time_increment=1 gives one row per ad per day, which is what makes
  // "top paid this month" an aggregation rather than a guess.
  const rows = await graphAll<AdRow>(
    `${cfg.adAccountId}/insights`,
    {
      level: 'ad',
      fields: 'ad_id,ad_name,spend,reach,clicks,impressions',
      time_increment: '1',
      time_range: JSON.stringify({ since: iso(since), until: iso(until) }),
      limit: '500',
    },
    cfg.token,
  )

  if (rows.length === 0) return 0

  // Metadata once per ad, so the page has something to show beside the numbers.
  const names = new Map<string, string>()
  for (const r of rows) if (r.ad_name) names.set(r.ad_id, r.ad_name)

  for (const [externalId, name] of names) {
    await prisma.socialPost.upsert({
      where: { platform_externalId: { platform: 'FACEBOOK', externalId } },
      create: {
        platform: 'FACEBOOK',
        kind: 'PAID',
        externalId,
        caption: name,
        // An ad has no single publish date that means anything; the day-grain
        // rows in AdDayStat carry the timing.
        publishedAt: new Date(),
      },
      update: { caption: name },
    })
  }

  let written = 0
  for (const r of rows) {
    await prisma.adDayStat.upsert({
      where: {
        platform_externalId_day: {
          platform: 'FACEBOOK',
          externalId: r.ad_id,
          day: day(r.date_start),
        },
      },
      create: {
        platform: 'FACEBOOK',
        externalId: r.ad_id,
        day: day(r.date_start),
        views: int(r.impressions),
        reach: int(r.reach),
        clicks: int(r.clicks),
        spendCents: cents(r.spend),
      },
      update: {
        views: int(r.impressions),
        reach: int(r.reach),
        clicks: int(r.clicks),
        spendCents: cents(r.spend),
        fetchedAt: new Date(),
      },
    })
    written++
  }
  return written
}

// ── Organic: Facebook ────────────────────────────────────────────────────────

async function pageToken(cfg: Cfg): Promise<string> {
  const res = await graph<{ data: { id: string; access_token: string }[] }>(
    'me/accounts',
    { fields: 'id,access_token' },
    cfg.token,
  )
  const match = res.data?.find((p) => p.id === cfg.pageId) ?? res.data?.[0]
  if (!match?.access_token) throw new Error('No page token returned for this system user')
  return match.access_token
}

async function ingestFacebookPosts(cfg: Cfg, pt: string): Promise<number> {
  const posts = await graphAll<{
    id: string
    message?: string
    story?: string
    created_time: string
    permalink_url?: string
  }>(
    `${cfg.pageId}/posts`,
    { fields: 'id,message,story,created_time,permalink_url', limit: '25' },
    pt,
    Math.ceil(POST_LIMIT / 25),
    true, // we only ever want the most recent POST_LIMIT posts
  )

  let written = 0
  for (const p of posts) {
    // "Lighthouse Care updated their cover photo" is not a post anyone wrote.
    // Those items carry a `story` but no `message`, and left in they show up in
    // the top-performing list with thousands of views and no meaning.
    if (!p.message) continue

    let views = 0
    let clicks = 0
    let engagements = 0
    try {
      const ins = await graph<{ data: { name: string; values: { value: unknown }[] }[] }>(
        `${p.id}/insights`,
        {
          metric:
            'post_media_view,post_clicks,post_reactions_by_type_total,post_activity_by_action_type',
        },
        pt,
      )
      for (const m of ins.data ?? []) {
        const v = m.values?.[0]?.value
        if (m.name === 'post_media_view') views = int(v as number)
        else if (m.name === 'post_clicks') clicks = int(v as number)
        // Reactions and activity are separate buckets: reactions are likes and
        // their variants, activity is comments and shares. Engagement means
        // both, and summing only the first undercounts by a long way.
        else engagements += sumActions(v)
      }
    } catch {
      // A single post refusing its insights must not lose the whole run — some
      // post types simply have none.
    }

    await prisma.socialPost.upsert({
      where: { platform_externalId: { platform: 'FACEBOOK', externalId: p.id } },
      create: {
        platform: 'FACEBOOK',
        kind: 'ORGANIC',
        externalId: p.id,
        caption: p.message ?? null,
        permalink: p.permalink_url ?? null,
        publishedAt: new Date(p.created_time),
        views,
        clicks,
        engagements,
      },
      update: { views, clicks, engagements, caption: p.message ?? null, fetchedAt: new Date() },
    })
    written++
  }
  return written
}

// ── Organic: Instagram ───────────────────────────────────────────────────────

async function ingestInstagram(cfg: Cfg, pt: string): Promise<number> {
  const media = await graph<{
    data: {
      id: string
      caption?: string
      timestamp: string
      permalink?: string
      media_url?: string
      thumbnail_url?: string
    }[]
  }>(
    `${cfg.igUserId}/media`,
    {
      fields: 'id,caption,timestamp,permalink,media_url,thumbnail_url',
      limit: String(POST_LIMIT),
    },
    pt,
  )

  let written = 0
  for (const m of media.data ?? []) {
    let views = 0
    let reach = 0
    let engagements = 0
    try {
      const ins = await graph<{ data: { name: string; values: { value: number }[] }[] }>(
        `${m.id}/insights`,
        { metric: 'views,reach,likes,comments,saved,shares' },
        pt,
      )
      for (const metric of ins.data ?? []) {
        const v = int(metric.values?.[0]?.value)
        if (metric.name === 'views') views = v
        else if (metric.name === 'reach') reach = v
        else engagements += v // likes + comments + saved + shares
      }
    } catch {
      // Stories and some media types expose a different metric set.
    }

    await prisma.socialPost.upsert({
      where: { platform_externalId: { platform: 'INSTAGRAM', externalId: m.id } },
      create: {
        platform: 'INSTAGRAM',
        kind: 'ORGANIC',
        externalId: m.id,
        caption: m.caption ?? null,
        permalink: m.permalink ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        publishedAt: new Date(m.timestamp),
        views,
        reach,
        engagements,
      },
      update: {
        views,
        reach,
        engagements,
        caption: m.caption ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        fetchedAt: new Date(),
      },
    })
    written++
  }
  return written
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Pull everything Meta. Each part is allowed to fail on its own: ads working
 * and Instagram breaking should leave ads on the page, not blank the lot.
 */
export async function ingestMeta(
  { days = AD_DAYS_DEFAULT }: { days?: number } = {},
): Promise<{ ok: boolean; rows: number; error?: string }> {
  const cfg = metaConfig()
  const run = await prisma.ingestRun.create({ data: { source: 'meta' }, select: { id: true } })

  if (!cfg) {
    const error = 'META_ACCESS_TOKEN / IDs not configured'
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: false, error, finishedAt: new Date() },
    })
    return { ok: false, rows: 0, error }
  }

  const problems: string[] = []
  let rows = 0

  try {
    rows += await ingestAds(cfg, days)
  } catch (e) {
    problems.push(`ads: ${(e as Error).message}`)
  }

  try {
    const pt = await pageToken(cfg)
    try {
      rows += await ingestFacebookPosts(cfg, pt)
    } catch (e) {
      problems.push(`facebook: ${(e as Error).message}`)
    }
    try {
      rows += await ingestInstagram(cfg, pt)
    } catch (e) {
      problems.push(`instagram: ${(e as Error).message}`)
    }
  } catch (e) {
    problems.push(`page token: ${(e as Error).message}`)
  }

  const ok = problems.length === 0
  await prisma.ingestRun.update({
    where: { id: run.id },
    data: {
      ok,
      rows,
      error: problems.join(' | ').slice(0, 1000) || null,
      finishedAt: new Date(),
    },
  })
  return { ok, rows, error: problems.join(' | ') || undefined }
}

export const META_PLATFORMS: SocialPlatform[] = ['FACEBOOK', 'INSTAGRAM']
