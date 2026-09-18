import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The two guards that stand between a suggestion and something irreversible.
 *
 * Tested in isolation because a regression in either is invisible until it
 * has already happened: a wrong image is public, or a budget is somewhere
 * nobody chose. Everything else in the assistant is recoverable.
 */

// The assistant module pulls in Prisma at import time, which a unit test has no
// business connecting to. Stubbed before the import so only the guard is under
// test.
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/marketing-tools', () => ({ READ_TOOLS: [] }))
// media-library imports @vercel/blob for listing; the rule under test is pure.
vi.mock('@vercel/blob', () => ({ list: async () => ({ blobs: [] }), del: async () => {} }))

const { assertOurAsset } = await import('@/lib/marketing-assistant')

describe('assertOurAsset', () => {
  const host = 'https://abc123.public.blob.vercel-storage.com'

  it('accepts an image from any content folder in the library', () => {
    for (const folder of ['media', 'events', 'stories', 'fundraisers', 'marketing-assets']) {
      expect(() => assertOurAsset(`${host}/${folder}/photo-x1y2.jpg`)).not.toThrow()
    }
  })

  it('refuses an image from anywhere else on the internet', () => {
    expect(() => assertOurAsset('https://example.com/nice-photo.jpg')).toThrow(/media library/)
  })

  it("refuses a volunteer's avatar", () => {
    // The case this exists for. Somebody's profile photo is not stock for an
    // advertisement, and the library deliberately does not contain it.
    expect(() => assertOurAsset(`${host}/avatars/cmt8826a6000a04jpfl8bxm4i.jpg`)).toThrow(
      /media library/,
    )
  })

  it('refuses a partner logo', () => {
    expect(() => assertOurAsset(`${host}/partner-logos/fulton-hogan.png`)).toThrow(/media library/)
  })

  it('refuses our blob host with no folder at all', () => {
    expect(() => assertOurAsset(`${host}/loose-file.jpg`)).toThrow(/media library/)
  })

  it('refuses a lookalike hostname', () => {
    expect(() =>
      assertOurAsset('https://blob.vercel-storage.com.evil.test/media/x.jpg'),
    ).toThrow(/media library/)
  })

  it('refuses plain http', () => {
    expect(() => assertOurAsset('http://abc.public.blob.vercel-storage.com/media/x.jpg')).toThrow(
      /media library/,
    )
  })

  it('refuses something that is not a URL at all', () => {
    expect(() => assertOurAsset('hamper-pack.jpg')).toThrow(/not a URL/)
  })
})

describe('setAdSetBudget ceiling', () => {
  beforeEach(() => {
    vi.stubEnv('META_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('META_AD_ACCOUNT_ID', '123')
    vi.stubEnv('META_PAGE_ID', '456')
    vi.stubEnv('META_IG_USER_ID', '789')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('refuses a budget above the ceiling without calling Meta', async () => {
    const { setAdSetBudget, MAX_DAILY_BUDGET_CENTS } = await import(
      '@/lib/integrations/meta-write'
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(setAdSetBudget('120000', MAX_DAILY_BUDGET_CENTS + 1)).rejects.toThrow(/ceiling/)
    // The point of the assertion: it fails before the network, so no partial
    // change can land.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refuses a budget under a dollar, and fractional cents', async () => {
    const { setAdSetBudget } = await import('@/lib/integrations/meta-write')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(setAdSetBudget('120000', 50)).rejects.toThrow(/at least \$1/)
    await expect(setAdSetBudget('120000', 1000.5)).rejects.toThrow(/whole number/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends a budget inside the ceiling as cents', async () => {
    const { setAdSetBudget } = await import('@/lib/integrations/meta-write')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(setAdSetBudget('120000', 4500)).resolves.toEqual({ success: true })

    const body = (fetchSpy.mock.calls[0][1]?.body as URLSearchParams).toString()
    expect(body).toContain('daily_budget=4500')
  })

  it('passes Meta’s own refusal through, because it names the missing scope', async () => {
    const { setAdSetStatus } = await import('@/lib/integrations/meta-write')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: '(#200) Requires ads_management permission', code: 200 },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(setAdSetStatus('120000', 'PAUSED')).rejects.toThrow(/ads_management/)
  })
})
