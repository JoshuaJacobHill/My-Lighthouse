/**
 * TikTok — reading our own posts and their figures.
 *
 * Structurally different from Meta in one way that matters. Meta gives a
 * Business Manager system-user token that never expires; TikTok gives an
 * access token good for a day and a refresh token good for a year, **and
 * hands back a new refresh token every time you use it**. So the refresh token
 * cannot live in an environment variable: the moment it is used, the one in
 * Vercel is stale, and when it eventually expires somebody has to re-authorise
 * by hand. It is persisted in AppSetting instead, and the variable is only
 * ever the starting value.
 *
 * Endpoints are TikTok's Display API v2. Every field name below is taken from
 * their documentation rather than the live account, which — on the evidence of
 * this project's afternoon with Gap Solutions and Instagram — makes them
 * assumptions, not facts. `probeTikTok` exists so the first thing done with
 * real credentials is to look at what actually comes back.
 */

import prisma from '@/lib/prisma'

const OAUTH_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/'

/** Where the rotating refresh token is kept. */
const REFRESH_KEY = 'tiktok.refresh_token'

/** Fields asked of the video list. Verified by probeTikTok before trusting. */
const VIDEO_FIELDS = [
  'id',
  'title',
  'video_description',
  'duration',
  'cover_image_url',
  'share_url',
  'create_time',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
].join(',')

export type TikTokConfig = {
  clientKey: string
  clientSecret: string
  /**
   * Optional, and only ever a starting value.
   *
   * The real refresh token normally arrives from the one-time authorisation
   * at /api/admin/tiktok-connect and lives in AppSetting from then on. This
   * exists so a token obtained some other way can be seeded without a
   * database write.
   */
  seedRefreshToken?: string
}

export function tiktokConfig(): TikTokConfig | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) return null
  return {
    clientKey,
    clientSecret,
    seedRefreshToken: process.env.TIKTOK_REFRESH_TOKEN || undefined,
  }
}

/**
 * The two scopes this actually uses, and no more.
 *
 * `user.info.stats` was requested at first and is not needed: nothing here
 * reads follower counts, only the video list. TikTok's Display API overview
 * names just these two, and every extra scope is another permission to
 * justify at review and another thing the account is handing over for no
 * return.
 *
 * Nothing here posts, deletes or changes anything on TikTok.
 */
export const TIKTOK_SCOPES = 'user.info.basic,video.list'

export const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'

/**
 * Turn the one-time authorisation code into tokens, and keep the refresh one.
 *
 * The only moment a refresh token is created. Everything afterwards rotates
 * the stored one, so if this write is lost the whole flow has to be repeated
 * by hand — which is why it is saved before anything else is attempted.
 */
export async function exchangeAuthorizationCode(
  cfg: TikTokConfig,
  code: string,
  redirectUri: string,
): Promise<{ refreshTokenSaved: boolean; expiresIn: number; scope?: string }> {
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: cfg.clientKey,
      client_secret: cfg.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  })

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !json.refresh_token) {
    // The description can echo the secret we just sent; the code cannot.
    throw new Error(
      `TikTok code exchange failed (${res.status})${json.error ? `: ${json.error}` : ''}`,
    )
  }

  await prisma.appSetting.upsert({
    where: { key: REFRESH_KEY },
    create: {
      key: REFRESH_KEY,
      value: json.refresh_token,
      label: 'TikTok refresh token (rotates on every use)',
      group: 'integrations',
    },
    update: { value: json.refresh_token },
  })

  if (json.access_token) {
    accessToken = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 86_400) * 1000,
    }
  }

  return { refreshTokenSaved: true, expiresIn: json.expires_in ?? 0, scope: json.scope }
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

/** Cached for the life of the process; a day's validity outlives any one run. */
let accessToken: { value: string; expiresAt: number } | null = null

export function resetTikTokToken(): void {
  accessToken = null
}

/** Whether a cached token is still worth using, with a minute of headroom. */
export function tokenIsFresh(
  token: { expiresAt: number } | null,
  now = Date.now(),
): boolean {
  return Boolean(token && token.expiresAt - 60_000 > now)
}

async function storedRefreshToken(cfg: TikTokConfig): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: REFRESH_KEY } })
  const token = row?.value?.trim() || cfg.seedRefreshToken
  if (!token) {
    // Says what to do rather than just failing: a refresh token can only be
    // created by a person authorising in a browser, so no amount of retrying
    // will produce one.
    throw new Error(
      'No TikTok refresh token yet — authorise once at /api/admin/tiktok-connect',
    )
  }
  return token
}

/**
 * Exchange the refresh token for an access token, and save the new refresh
 * token immediately.
 *
 * Saved before anything else is attempted: TikTok invalidates the old one as
 * soon as it issues a replacement, so a crash between the two would leave the
 * integration unable to authenticate at all until someone re-authorised it by
 * hand.
 */
async function refreshAccessToken(cfg: TikTokConfig): Promise<string> {
  const refresh = await storedRefreshToken(cfg)

  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: cfg.clientKey,
      client_secret: cfg.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
    cache: 'no-store',
  })

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !json.access_token) {
    // Never echo the body: it can contain the secret we just sent.
    throw new Error(
      `TikTok token refresh failed (${res.status})${json.error ? `: ${json.error}` : ''}`,
    )
  }

  if (json.refresh_token && json.refresh_token !== refresh) {
    await prisma.appSetting.upsert({
      where: { key: REFRESH_KEY },
      create: {
        key: REFRESH_KEY,
        value: json.refresh_token,
        label: 'TikTok refresh token (rotates on every use)',
        group: 'integrations',
      },
      update: { value: json.refresh_token },
    })
  }

  accessToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 86_400) * 1000,
  }
  return accessToken.value
}

async function token(cfg: TikTokConfig): Promise<string> {
  if (tokenIsFresh(accessToken)) return accessToken!.value
  return refreshAccessToken(cfg)
}

// ─── Reading videos ───────────────────────────────────────────────────────────

export type TikTokVideo = {
  id: string
  title?: string
  video_description?: string
  cover_image_url?: string
  share_url?: string
  /** Unix seconds. */
  create_time?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
}

type VideoListResponse = {
  data?: { videos?: TikTokVideo[]; cursor?: number; has_more?: boolean }
  error?: { code?: string; message?: string }
}

/**
 * Our own videos, newest first, following the cursor.
 *
 * `error.code` is `ok` on success even at HTTP 200, so both are checked — a
 * body-level error with a 200 status is the kind of failure that silently
 * ingests nothing and reports success.
 */
export async function listVideos(
  cfg: TikTokConfig,
  limit = 50,
): Promise<TikTokVideo[]> {
  const out: TikTokVideo[] = []
  let cursor: number | undefined
  const at = await token(cfg)

  for (let page = 0; page < 10 && out.length < limit; page++) {
    const res = await fetch(`${VIDEO_LIST_URL}?fields=${VIDEO_FIELDS}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_count: Math.min(20, limit - out.length),
        ...(cursor ? { cursor } : {}),
      }),
      cache: 'no-store',
    })

    const json = (await res.json().catch(() => ({}))) as VideoListResponse
    if (!res.ok || (json.error?.code && json.error.code !== 'ok')) {
      throw new Error(
        `TikTok video list failed (${res.status})${json.error?.message ? `: ${json.error.message}` : ''}`,
      )
    }

    const videos = json.data?.videos ?? []
    out.push(...videos)
    if (!json.data?.has_more || videos.length === 0) break
    cursor = json.data.cursor
  }

  return out.slice(0, limit)
}

// ─── Ingest ───────────────────────────────────────────────────────────────────

const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)

/**
 * Write videos into SocialPost, where the report already knows how to read
 * them: SocialPlatform.TIKTOK exists, the chart has a tick box for it, and
 * getTopSocial picks it up with no changes.
 *
 * TikTok gives no reach figure, so `reach` stays 0 rather than being guessed
 * from views. Engagements are likes plus comments plus shares, which is the
 * same definition used for Facebook and Instagram so the rate is comparable.
 */
export async function ingestTikTok(
  { limit = 50 }: { limit?: number } = {},
): Promise<{ ok: boolean; rows: number; error?: string }> {
  const cfg = tiktokConfig()
  const run = await prisma.ingestRun.create({ data: { source: 'tiktok' }, select: { id: true } })

  if (!cfg) {
    const error = 'TIKTOK_CLIENT_KEY / SECRET / REFRESH_TOKEN not configured'
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: false, error, finishedAt: new Date() },
    })
    return { ok: false, rows: 0, error }
  }

  try {
    const videos = await listVideos(cfg, limit)
    let rows = 0

    for (const v of videos) {
      const engagements = int(v.like_count) + int(v.comment_count) + int(v.share_count)
      await prisma.socialPost.upsert({
        where: { platform_externalId: { platform: 'TIKTOK', externalId: v.id } },
        create: {
          platform: 'TIKTOK',
          kind: 'ORGANIC',
          externalId: v.id,
          caption: v.video_description ?? v.title ?? null,
          permalink: v.share_url ?? null,
          thumbnailUrl: v.cover_image_url ?? null,
          publishedAt: v.create_time ? new Date(v.create_time * 1000) : new Date(),
          views: int(v.view_count),
          engagements,
        },
        update: {
          views: int(v.view_count),
          engagements,
          caption: v.video_description ?? v.title ?? null,
          thumbnailUrl: v.cover_image_url ?? null,
          fetchedAt: new Date(),
        },
      })
      rows++
    }

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: true, rows, finishedAt: new Date() },
    })
    return { ok: true, rows }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown error'
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: false, error: error.slice(0, 500), finishedAt: new Date() },
    })
    return { ok: false, rows: 0, error }
  }
}

// ─── Probe ────────────────────────────────────────────────────────────────────

/**
 * What TikTok actually returns, before anything is trusted.
 *
 * Field names here came from documentation, not from the account. Twice today
 * that has been the difference between a working feed and a silent zero — a
 * sales list hidden under a `list` key, and an Instagram figure that was the
 * wrong metric entirely. So the first thing done with real credentials is to
 * look.
 */
export async function probeTikTok(): Promise<
  | { ok: false; error: string }
  | { ok: true; count: number; fields: string[]; first: Record<string, unknown> | null }
> {
  const cfg = tiktokConfig()
  if (!cfg) return { ok: false, error: 'TikTok credentials not configured' }

  try {
    const videos = await listVideos(cfg, 3)
    const first = (videos[0] ?? null) as Record<string, unknown> | null
    return {
      ok: true,
      count: videos.length,
      fields: first ? Object.keys(first) : [],
      first,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown error' }
  }
}
