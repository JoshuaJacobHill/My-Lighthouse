import { metaConfig } from '@/lib/integrations/meta'

/**
 * What the live Meta token can actually do.
 *
 * Written because "I ticked the boxes and generated a new token" and "the app
 * can now post" are different claims, and the gap between them has three
 * causes that look identical from the outside: the scope was not ticked, the
 * token was never redeployed, or the system user has the permission but no
 * access to the Page or ad account it applies to.
 *
 * So this checks all three — the scopes on the token, and whether each asset
 * actually answers.
 */

const V = 'v26.0'
const BASE = `https://graph.facebook.com/${V}`

/**
 * Needed by the nightly ingest. Losing one of these breaks the reports.
 *
 * `business_management` is deliberately not here, though it is the scope a
 * Meta setup guide will tell you to grant. This app never calls a Business
 * Manager endpoint — it reads the page, the Instagram account and the ad
 * account directly, each of which is covered above. Listing it only sent
 * someone looking for a permission nothing needed.
 */
export const READ_SCOPES = [
  'ads_read',
  'pages_read_engagement',
  'pages_show_list',
  'instagram_basic',
  'instagram_manage_insights',
] as const

/** Needed by the approval queue. Nothing else uses them. */
export const WRITE_SCOPES = [
  'ads_management',
  'pages_manage_posts',
  'instagram_content_publish',
] as const

export type ScopeReport = {
  configured: boolean
  valid: boolean
  /** Null where the token never expires, which is what a system user should have. */
  expiresAt: string | null
  scopes: string[]
  read: { scope: string; granted: boolean }[]
  write: { scope: string; granted: boolean }[]
  assets: { name: string; id: string; ok: boolean; detail: string }[]
  error?: string
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { cache: 'no-store' })
  const json = (await res.json()) as T & { error?: { message: string; code: number } }
  if (json.error) throw new Error(`${json.error.message} (code ${json.error.code})`)
  return json
}

/** Can the token actually reach this thing? The half that scopes do not answer. */
async function probe(
  name: string,
  id: string,
  fields: string,
  token: string,
): Promise<{ name: string; id: string; ok: boolean; detail: string }> {
  try {
    const res = await graph<{ name?: string; username?: string }>(id, { fields, access_token: token })
    return { name, id, ok: true, detail: res.name ?? res.username ?? 'reachable' }
  } catch (e) {
    return { name, id, ok: false, detail: (e as Error).message }
  }
}

export async function checkMetaScopes(): Promise<ScopeReport> {
  const empty = {
    configured: false,
    valid: false,
    expiresAt: null,
    scopes: [],
    read: READ_SCOPES.map((s) => ({ scope: s, granted: false })),
    write: WRITE_SCOPES.map((s) => ({ scope: s, granted: false })),
    assets: [],
  }

  const cfg = metaConfig()
  if (!cfg) return { ...empty, error: 'Meta is not configured — META_ACCESS_TOKEN or an ID is missing.' }

  let scopes: string[] = []
  let valid = false
  let expiresAt: string | null = null

  try {
    // A system user token can debug itself, so this needs no app secret.
    const res = await graph<{
      data: { is_valid: boolean; scopes?: string[]; expires_at?: number }
    }>('debug_token', { input_token: cfg.token, access_token: cfg.token })
    valid = Boolean(res.data?.is_valid)
    scopes = res.data?.scopes ?? []
    // 0 means it never expires, which is what a system user token should be.
    expiresAt = res.data?.expires_at ? new Date(res.data.expires_at * 1000).toISOString() : null
  } catch (e) {
    return { ...empty, configured: true, error: (e as Error).message }
  }

  const has = (s: string) => scopes.includes(s)

  const assets = await Promise.all([
    probe('Facebook page', cfg.pageId, 'name', cfg.token),
    probe('Instagram account', cfg.igUserId, 'username', cfg.token),
    probe('Ad account', cfg.adAccountId, 'name', cfg.token),
  ])

  return {
    configured: true,
    valid,
    expiresAt,
    scopes,
    read: READ_SCOPES.map((s) => ({ scope: s, granted: has(s) })),
    write: WRITE_SCOPES.map((s) => ({ scope: s, granted: has(s) })),
    assets,
  }
}
