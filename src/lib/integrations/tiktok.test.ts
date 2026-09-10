import { describe, expect, it, vi, afterEach } from 'vitest'

// The database is mocked away: what is tested here is the token decision and
// the failure handling, not the ledger. AppSetting is stubbed because the
// refresh token lives there — TikTok rotates it on every use, so reading and
// writing it is part of authenticating rather than a side effect.
const saved: { value?: string } = {}
vi.mock('@/lib/prisma', () => ({
  default: {
    appSetting: {
      findUnique: async () => (saved.value ? { value: saved.value } : null),
      upsert: async ({ create, update }: { create?: { value: string }; update?: { value: string } }) => {
        saved.value = update?.value ?? create?.value
        return { value: saved.value }
      },
    },
  },
}))

import { listVideos, resetTikTokToken, tokenIsFresh, type TikTokConfig } from './tiktok'

const cfg: TikTokConfig = {
  clientKey: 'key',
  clientSecret: 'never-logged',
  seedRefreshToken: 'seed-refresh',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  // The access token is cached for the life of the process — one process, one
  // token, which is right in production and would let one test's token satisfy
  // the next test's request, hiding whether it authenticates at all.
  resetTikTokToken()
  delete saved.value
})

describe('access token freshness', () => {
  const now = 1_800_000_000_000

  it('reuses a token that has time left', () => {
    expect(tokenIsFresh({ expiresAt: now + 3600_000 }, now)).toBe(true)
  })

  it('refreshes a minute before expiry rather than at it', () => {
    // A token that expires mid-request is a failure that looks random.
    expect(tokenIsFresh({ expiresAt: now + 30_000 }, now)).toBe(false)
  })

  it('treats an absent or expired token as stale', () => {
    expect(tokenIsFresh(null, now)).toBe(false)
    expect(tokenIsFresh({ expiresAt: now - 1 }, now)).toBe(false)
  })
})

describe('reading videos', () => {
  it('fails loudly on a body-level error served with HTTP 200', async () => {
    // TikTok does this. Treating it as success would ingest nothing and
    // report that everything went fine.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) =>
        String(input).includes('oauth')
          ? json({ access_token: 'at', expires_in: 86400, refresh_token: 'seed-refresh' })
          : json({ error: { code: 'access_token_invalid', message: 'bad token' } }),
      ),
    )
    await expect(listVideos(cfg, 5)).rejects.toThrow(/bad token/)
  })

  it('never puts the client secret in an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'invalid_client', error_description: 'never-logged' }, 401)),
    )
    await expect(listVideos(cfg, 5)).rejects.toThrow(/token refresh failed \(401\)/)
    await expect(listVideos(cfg, 5)).rejects.not.toThrow(/never-logged/)
  })

  it('follows the cursor and stops at the limit', async () => {
    let page = 0
    const f = vi.fn(async (input: string | URL) => {
      if (String(input).includes('oauth')) {
        return json({ access_token: 'at', expires_in: 86400, refresh_token: 'seed-refresh' })
      }
      page++
      return json({
        data: {
          videos: Array.from({ length: 20 }, (_, i) => ({ id: `v${page}-${i}`, view_count: 10 })),
          cursor: page,
          has_more: true,
        },
      })
    })
    vi.stubGlobal('fetch', f)

    const videos = await listVideos(cfg, 25)
    expect(videos).toHaveLength(25)
    expect(new Set(videos.map((v) => v.id)).size).toBe(25)
  })

  it('stops when TikTok says there is no more', async () => {
    const f = vi.fn(async (input: string | URL) =>
      String(input).includes('oauth')
        ? json({ access_token: 'at', expires_in: 86400, refresh_token: 'seed-refresh' })
        : json({ data: { videos: [{ id: 'only' }], has_more: false } }),
    )
    vi.stubGlobal('fetch', f)
    const videos = await listVideos(cfg, 50)
    expect(videos).toHaveLength(1)
    // One token call plus one page, and no pointless second page.
    expect(f).toHaveBeenCalledTimes(2)
  })
})

describe('the rotating refresh token', () => {
  it('saves the new refresh token TikTok hands back', async () => {
    // The old one is invalid the moment a replacement is issued, so if this is
    // not persisted the integration can never authenticate again without
    // somebody re-authorising it by hand.
    const f = vi.fn(async (input: string | URL, init?: RequestInit) => {
      void init
      return String(input).includes('oauth')
        ? json({ access_token: 'at', expires_in: 86400, refresh_token: 'rotated-1' })
        : json({ data: { videos: [{ id: 'a' }], has_more: false } })
    })
    vi.stubGlobal('fetch', f)

    await listVideos(cfg, 1)

    const body = (f.mock.calls[0][1] as RequestInit | undefined)?.body as URLSearchParams
    // First call used the seed, since nothing was stored yet.
    expect(body.get('refresh_token')).toBe('seed-refresh')
    expect(saved.value).toBe('rotated-1')
  })
})
