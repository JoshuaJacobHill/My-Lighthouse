/**
 * The half of the Meta API that changes things.
 *
 * Kept in its own file, away from the ingest code, because the two have
 * opposite risk profiles. A bug in `meta.ts` gives us a wrong number on a
 * report. A bug in here posts to twelve thousand followers or moves a budget.
 *
 * Nothing in this file is called by the assistant. Everything here is called
 * by the executor, after a person has approved a specific proposal — see
 * `marketing-proposals.ts`. If you find yourself importing this from the chat
 * path, stop: that is the one thing the design is built to prevent.
 *
 * Required token scopes, none of which the read-only ingest needs:
 *   pages_manage_posts          publish to the Facebook page
 *   instagram_content_publish   publish to Instagram
 *   ads_management              change ad set budgets and status
 *
 * Until those are granted, every function here fails with Meta's own
 * permission error. That is the correct behaviour, and the message is passed
 * through verbatim rather than softened, because the fix is in Meta's app
 * settings and the error names the missing scope.
 */

import { metaConfig } from '@/lib/integrations/meta'

const V = 'v26.0'
const BASE = `https://graph.facebook.com/${V}`

/** A POST to the Graph API. Errors carry Meta's own words — they name the fix. */
async function graphPost<T>(
  path: string,
  body: Record<string, string>,
  token: string,
): Promise<T> {
  const form = new URLSearchParams({ ...body, access_token: token })
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
  })
  const json = (await res.json()) as T & {
    error?: { message: string; code: number; error_user_msg?: string }
  }
  if (json.error) {
    const e = json.error
    throw new Error(`Meta ${path} refused (${e.code}): ${e.error_user_msg || e.message}`)
  }
  return json
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const url = new URL(`${BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)
  const res = await fetch(url, { cache: 'no-store' })
  const json = (await res.json()) as T & { error?: { message: string; code: number } }
  if (json.error) throw new Error(`Meta ${path} failed (${json.error.code}): ${json.error.message}`)
  return json
}

/** The page token, which is what publishing needs — not the system user token. */
async function pageToken(token: string, pageId: string): Promise<string> {
  const res = await graphGet<{ data: { id: string; access_token: string }[] }>(
    'me/accounts',
    { fields: 'id,access_token' },
    token,
  )
  const match = res.data?.find((p) => p.id === pageId) ?? res.data?.[0]
  if (!match?.access_token) throw new Error('No page token returned for this system user')
  return match.access_token
}

function requireConfig() {
  const cfg = metaConfig()
  if (!cfg) throw new Error('Meta is not configured — check META_ACCESS_TOKEN and the IDs.')
  return cfg
}

// ─── Ad sets ──────────────────────────────────────────────────────────────────

export type AdSet = {
  id: string
  name: string
  status: string
  /** Meta reports budgets in cents of the account currency. */
  dailyBudgetCents: number | null
  campaignName: string | null
}

/**
 * The ad sets on the account.
 *
 * Read-only, and safe for the assistant to see — it is how Claude can name a
 * real ad set instead of inventing one. Budgets live on the ad set rather than
 * the ad, which is why a "change the budget" proposal targets this level.
 */
export async function listAdSets(): Promise<AdSet[]> {
  const cfg = requireConfig()
  const res = await graphGet<{
    data: {
      id: string
      name: string
      status: string
      daily_budget?: string
      campaign?: { name?: string }
    }[]
  }>(
    `${cfg.adAccountId}/adsets`,
    { fields: 'id,name,status,daily_budget,campaign{name}', limit: '100' },
    cfg.token,
  )
  return (res.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    dailyBudgetCents: a.daily_budget ? Number(a.daily_budget) : null,
    campaignName: a.campaign?.name ?? null,
  }))
}

/** One ad set as it is right now, for the before-and-after on a proposal. */
export async function getAdSet(adSetId: string): Promise<AdSet> {
  const cfg = requireConfig()
  const a = await graphGet<{
    id: string
    name: string
    status: string
    daily_budget?: string
    campaign?: { name?: string }
  }>(adSetId, { fields: 'id,name,status,daily_budget,campaign{name}' }, cfg.token)
  return {
    id: a.id,
    name: a.name,
    status: a.status,
    dailyBudgetCents: a.daily_budget ? Number(a.daily_budget) : null,
    campaignName: a.campaign?.name ?? null,
  }
}

/** A hard ceiling, independent of anything Claude or the approver types. */
export const MAX_DAILY_BUDGET_CENTS = 50_000 // $500/day

/**
 * Change an ad set's daily budget.
 *
 * The ceiling is enforced here, at the last possible moment, rather than only
 * in the form. A limit that lives in the UI is a limit that a second caller
 * does not have.
 */
export async function setAdSetBudget(
  adSetId: string,
  dailyBudgetCents: number,
): Promise<{ success: boolean }> {
  const cfg = requireConfig()
  if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents < 100) {
    throw new Error('A daily budget must be a whole number of cents, at least $1.')
  }
  if (dailyBudgetCents > MAX_DAILY_BUDGET_CENTS) {
    throw new Error(
      `$${(dailyBudgetCents / 100).toFixed(0)}/day is above the $${MAX_DAILY_BUDGET_CENTS / 100} ceiling this tool will set. Change it in Ads Manager if that is really the intent.`,
    )
  }
  return graphPost<{ success: boolean }>(
    adSetId,
    { daily_budget: String(dailyBudgetCents) },
    cfg.token,
  )
}

/** Pause or resume an ad set. */
export async function setAdSetStatus(
  adSetId: string,
  status: 'PAUSED' | 'ACTIVE',
): Promise<{ success: boolean }> {
  const cfg = requireConfig()
  return graphPost<{ success: boolean }>(adSetId, { status }, cfg.token)
}

// ─── Publishing ───────────────────────────────────────────────────────────────

/**
 * Post to the Facebook page.
 *
 * With an image it goes to /photos, without one to /feed — different edges,
 * and posting a caption to /photos with no image simply fails.
 */
export async function publishFacebookPost(
  caption: string,
  imageUrl?: string,
): Promise<{ id: string }> {
  const cfg = requireConfig()
  const pt = await pageToken(cfg.token, cfg.pageId)

  if (imageUrl) {
    const res = await graphPost<{ id: string; post_id?: string }>(
      `${cfg.pageId}/photos`,
      { url: imageUrl, caption },
      pt,
    )
    return { id: res.post_id ?? res.id }
  }
  return graphPost<{ id: string }>(`${cfg.pageId}/feed`, { message: caption }, pt)
}

/**
 * Post to Instagram.
 *
 * Two steps, and both are required: create a media container, then publish it.
 * The image must be at a public URL — Instagram fetches it itself and will not
 * take an upload, which is why proposals carry a Blob URL rather than a file.
 */
export async function publishInstagramPost(
  caption: string,
  imageUrl: string,
): Promise<{ id: string }> {
  const cfg = requireConfig()
  if (!imageUrl) throw new Error('Instagram will not take a post without an image.')
  const pt = await pageToken(cfg.token, cfg.pageId)

  const container = await graphPost<{ id: string }>(
    `${cfg.igUserId}/media`,
    { image_url: imageUrl, caption },
    pt,
  )
  return graphPost<{ id: string }>(
    `${cfg.igUserId}/media_publish`,
    { creation_id: container.id },
    pt,
  )
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

/**
 * Where a "shop now" click goes when nothing else is specified.
 *
 * Every ad needs a destination, and an ad without one cannot be created at
 * all. The online store is the right default for a charity whose ads exist to
 * sell trolleys.
 */
const DEFAULT_LINK = 'https://shop.lighthousecare.org.au'

export type AdSummary = {
  id: string
  name: string
  adSetId: string
  adSetName: string | null
  /** What Meta says right now: ACTIVE, PAUSED, IN_PROCESS, DISAPPROVED… */
  effectiveStatus: string
  /** Why Meta rejected it, where it did. This is what you would open Ads Manager for. */
  issues: string[]
  createdAt: string | null
}

/**
 * Every ad on the account, with why Meta is unhappy where it is.
 *
 * `effective_status` rather than `status`, because they differ in exactly the
 * case that matters: an ad you set ACTIVE that Meta then rejected still reads
 * `status: ACTIVE` and `effective_status: DISAPPROVED`. Showing the first
 * would tell someone their ad is running when it is not.
 */
export async function listAds(limit = 50): Promise<AdSummary[]> {
  const cfg = requireConfig()
  const res = await graphGet<{
    data: {
      id: string
      name: string
      adset_id: string
      adset?: { name?: string }
      effective_status: string
      created_time?: string
      issues_info?: { error_summary?: string; error_message?: string }[]
    }[]
  }>(
    `${cfg.adAccountId}/ads`,
    {
      fields: 'id,name,adset_id,adset{name},effective_status,created_time,issues_info',
      limit: String(limit),
    },
    cfg.token,
  )
  return (res.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    adSetId: a.adset_id,
    adSetName: a.adset?.name ?? null,
    effectiveStatus: a.effective_status,
    issues: (a.issues_info ?? [])
      .map((i) => i.error_message || i.error_summary || '')
      .filter(Boolean),
    createdAt: a.created_time ?? null,
  }))
}

/**
 * Meta's own rendering of an ad, as an embeddable iframe.
 *
 * The piece that makes approving from this app rather than Ads Manager a
 * reasonable thing to do. Without it somebody is agreeing to publish an
 * advertisement they have not seen, which is not an approval — it is a guess.
 */
export async function getAdPreview(
  adId: string,
  format = 'MOBILE_FEED_STANDARD',
): Promise<string | null> {
  const cfg = requireConfig()
  const res = await graphGet<{ data: { body: string }[] }>(
    `${adId}/previews`,
    { ad_format: format },
    cfg.token,
  )
  return res.data?.[0]?.body ?? null
}

/** The same, for a creative that has no ad yet. */
export async function getCreativePreview(
  creativeId: string,
  format = 'MOBILE_FEED_STANDARD',
): Promise<string | null> {
  const cfg = requireConfig()
  const res = await graphGet<{ data: { body: string }[] }>(
    `${creativeId}/previews`,
    { ad_format: format },
    cfg.token,
  )
  return res.data?.[0]?.body ?? null
}

/**
 * A creative from an image and some words.
 *
 * `picture` takes the image URL directly, so there is no separate upload step
 * and the Blob URL the asset folder already serves is enough. The image must
 * be publicly reachable — Meta fetches it, the same way Instagram does.
 */
export async function createAdCreative(input: {
  name: string
  message: string
  imageUrl: string
  linkUrl?: string
  headline?: string
  description?: string
  callToAction?: string
}): Promise<{ id: string }> {
  const cfg = requireConfig()
  const link = input.linkUrl?.trim() || DEFAULT_LINK

  const spec = {
    page_id: cfg.pageId,
    link_data: {
      link,
      message: input.message,
      picture: input.imageUrl,
      ...(input.headline ? { name: input.headline } : {}),
      ...(input.description ? { description: input.description } : {}),
      call_to_action: {
        type: input.callToAction || 'SHOP_NOW',
        value: { link },
      },
    },
  }

  return graphPost<{ id: string }>(
    `${cfg.adAccountId}/adcreatives`,
    { name: input.name.slice(0, 100), object_story_spec: JSON.stringify(spec) },
    cfg.token,
  )
}

/**
 * A creative that puts money behind a post which already exists.
 *
 * Different from the above in the way that matters: boosting keeps the post's
 * existing likes, comments and shares, where a new creative starts at zero.
 * For a post already doing well organically that social proof is most of why
 * it is worth boosting at all.
 */
export async function createBoostCreative(input: {
  name: string
  postId: string
}): Promise<{ id: string }> {
  const cfg = requireConfig()
  return graphPost<{ id: string }>(
    `${cfg.adAccountId}/adcreatives`,
    {
      name: input.name.slice(0, 100),
      object_story_id: input.postId,
    },
    cfg.token,
  )
}

/**
 * A new ad in an existing ad set.
 *
 * Always created PAUSED, whatever the caller wants. Going live is a separate
 * approval, after somebody has looked at the preview — the two decisions are
 * "is this the right advertisement" and "should it start spending now", and
 * running them together is how the wrong picture ends up in front of twelve
 * thousand people.
 */
export async function createAd(input: {
  name: string
  adSetId: string
  creativeId: string
}): Promise<{ id: string }> {
  const cfg = requireConfig()
  return graphPost<{ id: string }>(
    `${cfg.adAccountId}/ads`,
    {
      name: input.name.slice(0, 100),
      adset_id: input.adSetId,
      creative: JSON.stringify({ creative_id: input.creativeId }),
      status: 'PAUSED',
    },
    cfg.token,
  )
}

/** Turn one ad on or off. The ad, not the ad set it sits in. */
export async function setAdStatus(
  adId: string,
  status: 'PAUSED' | 'ACTIVE',
): Promise<{ success: boolean }> {
  const cfg = requireConfig()
  return graphPost<{ success: boolean }>(adId, { status }, cfg.token)
}
