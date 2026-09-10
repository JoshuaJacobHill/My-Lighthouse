/**
 * Gap Solutions EMC (EM Cloud) — read-only client.
 *
 * Only three endpoints are used, and all three were verified against the live
 * tenant. Nothing else is guessed at: an invented path against a restricted
 * integration account returns 403 and teaches us nothing.
 *
 *   POST /api/session/CreateToken      → a bearer token
 *   GET  /api/store/{id}/sales         → sale headers for a window
 *   GET  /api/storesale/{saleHeaderID} → one sale in detail
 *
 * `/api/customer/{guid}/sales` is deliberately NOT used — the integration
 * account is refused it, and this bridge does not need it.
 *
 * Two things about EMC that shape everything here:
 *
 *  1. Tokens go stale without warning. Every request therefore refreshes once
 *     on a 401 and retries itself. Nobody should ever have to paste a token in.
 *  2. The date parameters are naive local time — `2026-09-09T00:00:00`, no
 *     zone. They are Brisbane wall-clock, so windows are formatted as Brisbane
 *     rather than as UTC, or a query would silently be ten hours out.
 *
 * This module is deliberately free of database and Prisma imports so it can be
 * unit-tested against a mocked fetch.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

/** One Gap Solutions store: its EMC id, and what the report calls it. */
export type GapStore = {
  id: number
  /** Must match the label used in SalesFact.store. */
  name: string
}

export type GapConfig = {
  baseUrl: string
  email: string
  password: string
  persistent: boolean
  stores: GapStore[]
}

/**
 * Stores come from the environment, one variable each:
 *
 *   EMC_LOGANHOLME_STORE_ID=1
 *   EMC_HILLCREST_STORE_ID=2
 *
 * Adding a store is therefore a settings change, not a code change — which is
 * the whole reason for reading them this way rather than hard-coding store 1.
 * The name in the middle becomes the store's label in the sales report, so it
 * has to match how the report already spells it.
 */
export function gapStores(env: Record<string, string | undefined> = process.env): GapStore[] {
  const stores: GapStore[] = []

  for (const [key, raw] of Object.entries(env)) {
    const m = /^EMC_([A-Z0-9_]+)_STORE_ID$/.exec(key)
    if (!m || !raw?.trim()) continue
    const id = Number(raw)
    if (!Number.isFinite(id)) continue
    stores.push({ id, name: titleCase(m[1]) })
  }

  // The original single-store shape, still honoured.
  if (stores.length === 0) {
    const id = Number(env.EMC_STORE_ID)
    if (Number.isFinite(id)) {
      stores.push({ id, name: env.EMC_STORE_NAME?.trim() || 'Loganholme' })
    }
  }

  return stores.sort((a, b) => a.id - b.id)
}

/** LOGANHOLME → Loganholme, MOUNT_WARREN → Mount Warren. */
function titleCase(slug: string): string {
  return slug
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function gapConfig(): GapConfig | null {
  const baseUrl = process.env.EMC_BASE_URL?.replace(/\/+$/, '')
  const email = process.env.EMC_EMAIL
  const password = process.env.EMC_PASSWORD
  if (!baseUrl || !email || !password) return null

  const stores = gapStores()
  if (stores.length === 0) return null

  return {
    baseUrl,
    email,
    password,
    persistent: process.env.EMC_PERSISTENT !== 'false',
    stores,
  }
}

/** Brisbane never observes daylight saving, so the offset is a constant. */
export const BRISBANE_OFFSET_MINUTES = 10 * 60

// ─── Errors ───────────────────────────────────────────────────────────────────

export class GapError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True for 403 — a permissions problem no amount of retrying fixes. */
    readonly permanent: boolean,
  ) {
    super(message)
    this.name = 'GapError'
  }
}

// ─── Types (only the fields we actually read) ─────────────────────────────────

export type GapSaleHeader = {
  saleHeaderID: number
  saleIdentifier: string
  storeID: number
  tranType: number
  itemCount?: number
  /** Cents. 7194 is $71.94. */
  totalAmount: number
  /** 1 for a web order. Counter sales are 0 and carry a `machineName` lane. */
  externalSale?: number | boolean
  /** The till. Null on web orders, which is the same signal from the other side. */
  machineName?: string | null
  /** Unambiguous instant where EMC provides one. */
  created?: string
  /** Brisbane wall-clock fallback. */
  createdLocal?: string
}

/**
 * The detail response also carries payment, card, EFTPOS, operator and
 * basket-level information. None of it is described here, and none of it is
 * read, stored or logged — the narrow type is the safeguard.
 */
export type GapSaleDetail = {
  saleHeaderID: number
  customerGuid?: string
  customer?: {
    email?: string | null
    mobile?: string | null
    givenName?: string | null
    familyName?: string | null
    postalCode?: string | null
    emailMarketing?: boolean | null
    smsMarketing?: boolean | null
    /**
     * EMC sends more than this. Nothing reads an undeclared field — the
     * coverage check counts their names to show what is available, and even
     * that never looks at a value.
     */
    [key: string]: unknown
  } | null
}

/** EMC's way of saying "no customer". */
export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

/**
 * Whether a sale came in from the web rather than a till.
 *
 * Two independent signals agree in the live data — `externalSale = 1` and no
 * `machineName` — so either will do and the flag is the more explicit of the
 * two. Tolerates a boolean as well as 0/1 because the tenant returns numbers
 * and nothing documents that it always will.
 */
export function isExternalSale(header: Pick<GapSaleHeader, 'externalSale' | 'machineName'>): boolean {
  const flag = header.externalSale
  if (flag === true || flag === 1) return true
  if (flag === false || flag === 0) return false
  // No flag at all: fall back to the missing till lane.
  return !header.machineName
}

export function hasRealCustomer(detail: Pick<GapSaleDetail, 'customerGuid'>): boolean {
  const g = detail.customerGuid?.trim().toLowerCase()
  if (!g) return false
  return g !== EMPTY_GUID
}

// ─── Token handling ───────────────────────────────────────────────────────────

/**
 * Cached for the life of the process. A serverless invocation authenticates
 * once and reuses it; a cold start pays for one extra call, which is cheaper
 * than storing a credential-equivalent token in the database.
 */
let cachedToken: string | null = null

/** Exposed for tests, and for a manual "forget the token" in the admin console. */
export function resetGapToken(): void {
  cachedToken = null
}

/**
 * EMC has been observed returning the token both as a bare string and wrapped
 * in an object. Rather than guess which, accept either and fail loudly if it
 * is neither — a silently empty token would present as a confusing 401 loop.
 */
function extractToken(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) return body.trim().replace(/^"|"$/g, '')
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>
    for (const key of ['token', 'Token', 'access_token', 'accessToken', 'sessionToken', 'value']) {
      const v = o[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return null
}

export async function createToken(cfg: GapConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/api/session/CreateToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: cfg.email, password: cfg.password, persistent: cfg.persistent }),
    cache: 'no-store',
  })

  const text = await res.text()
  if (!res.ok) {
    // Never include the body: a failed sign-in response can echo the request.
    throw new GapError(`EMC CreateToken failed (${res.status})`, res.status, res.status === 403)
  }

  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    /* a bare string token */
  }

  const token = extractToken(parsed)
  if (!token) throw new GapError('EMC CreateToken returned no usable token', 500, false)
  cachedToken = token
  return token
}

// ─── Request plumbing ─────────────────────────────────────────────────────────

const MAX_BACKOFF_ATTEMPTS = 4

function backoffMs(attempt: number): number {
  // 400ms, 800ms, 1.6s, 3.2s — bounded, and short enough for a cron window.
  return 400 * 2 ** attempt
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * One EMC GET, with the retry rules the tenant actually needs:
 *
 *   401 → the token went stale. Refresh once, retry once, never twice: a real
 *         credential problem would otherwise loop forever against their login.
 *   403 → permissions. Fail immediately and say so; retrying is just noise in
 *         their logs and ours.
 *   429 → back off and retry.
 *   5xx → back off and retry, bounded.
 */
async function emcGet<T>(cfg: GapConfig, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${cfg.baseUrl}${path}`)
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v)

  let refreshed = false

  for (let attempt = 0; ; attempt++) {
    const token = cachedToken ?? (await createToken(cfg))

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })

    if (res.ok) return (await res.json()) as T

    if (res.status === 401 && !refreshed) {
      refreshed = true
      cachedToken = null
      await createToken(cfg)
      continue
    }

    if (res.status === 403) {
      throw new GapError(`EMC ${path} refused (403) — integration account permissions`, 403, true)
    }

    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < MAX_BACKOFF_ATTEMPTS) {
      await sleep(backoffMs(attempt))
      continue
    }

    throw new GapError(`EMC ${path} failed (${res.status})`, res.status, false)
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * EMC wants naive Brisbane wall-clock, e.g. `2026-09-09T00:00:00`.
 *
 * Formatting a UTC instant as if it were local would ask for a window ten
 * hours in the past, which is the kind of bug that looks like "no sales today".
 */
export function toEmcDateParam(instant: Date): string {
  const shifted = new Date(instant.getTime() + BRISBANE_OFFSET_MINUTES * 60_000)
  return shifted.toISOString().slice(0, 19)
}

/**
 * The instant a sale happened.
 *
 * `created` is preferred and treated as UTC unless it carries its own offset.
 * `createdLocal` is Brisbane wall-clock, so it needs the offset applied. The
 * chosen source is returned so a run can be checked without guessing.
 */
export function saleInstant(header: Pick<GapSaleHeader, 'created' | 'createdLocal'>): {
  at: Date
  source: 'created' | 'createdLocal'
} | null {
  const { created, createdLocal } = header

  if (created) {
    const explicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(created.trim())
    const at = new Date(explicitZone ? created : `${created.replace(/\s+/, 'T')}Z`)
    if (!Number.isNaN(at.getTime())) return { at, source: 'created' }
  }

  if (createdLocal) {
    const naive = createdLocal.trim().replace(/\s+/, 'T').replace(/(?:Z|[+-]\d{2}:?\d{2})$/, '')
    const at = new Date(`${naive}+10:00`)
    if (!Number.isNaN(at.getTime())) return { at, source: 'createdLocal' }
  }

  return null
}

// ─── The three endpoints ──────────────────────────────────────────────────────

/**
 * Find the array in an EMC response.
 *
 * EMC returns `{ list: [...] }`, which cost a day: the first version of this
 * checked for a bare array, `items` and `data`, missed `list`, and so read a
 * busy trading hour as zero sales — a 200 with an empty list is
 * indistinguishable from no sales having happened. So rather than keep adding
 * names to a guess-list, take whichever top-level key holds an array. A
 * response with one list in it is unambiguous, and a future rename cannot
 * silently empty the feed again.
 */
export function findRows(body: unknown): { rows: unknown[]; shape: string } {
  if (Array.isArray(body)) return { rows: body, shape: 'array' }

  if (body && typeof body === 'object') {
    const keys = Object.keys(body as Record<string, unknown>)
    for (const k of keys) {
      const v = (body as Record<string, unknown>)[k]
      if (Array.isArray(v)) return { rows: v, shape: `object.${k}[]` }
    }
    return { rows: [], shape: `object{${keys.join(',')}}` }
  }

  return { rows: [], shape: typeof body }
}

/**
 * Sale headers for a window.
 *
 * `ExcludeVoids` is asked for at the source rather than filtered here, so a
 * voided sale never even reaches the deduplication ledger.
 *
 * Note the header also carries tender, card, authorisation and operator
 * fields. `GapSaleHeader` deliberately does not describe them and nothing
 * reads them, so they are dropped where they arrive.
 */
export async function getStoreSales(
  cfg: GapConfig,
  store: GapStore,
  opts: { start: Date; end: Date; take?: number },
): Promise<GapSaleHeader[]> {
  const body = await emcGet<unknown>(cfg, `/api/store/${store.id}/sales`, {
    StartDate: toEmcDateParam(opts.start),
    EndDate: toEmcDateParam(opts.end),
    ExcludeVoids: 'true',
    Take: String(opts.take ?? 500),
  })

  return findRows(body).rows as GapSaleHeader[]
}

/**
 * Format an instant as naive UTC wall-clock.
 *
 * The counterpart to `toEmcDateParam`. Which of the two EMC actually means is
 * not documented, and a whole-day window returns rows under either reading —
 * so only a narrow window can tell them apart. `probeSales` asks both.
 */
export function toUtcDateParam(instant: Date): string {
  return instant.toISOString().slice(0, 19)
}

export type SalesProbe = {
  label: string
  params: Record<string, string>
  /** GET unless the endpoint refuses it. */
  method?: 'GET' | 'POST'
  /** HTTP status, or 0 if the request itself failed. */
  status: number
  /** How the body arrived: an array, or an object with these top-level keys. */
  shape: string
  count: number
  /**
   * Field names on the first row. Sale headers carry no personal information —
   * ids, times, counts and totals — so this is safe to show.
   */
  firstRowKeys?: string[]
  /** The first row's identifying and timing fields, for eyeballing. */
  firstRow?: Record<string, unknown>
  error?: string
}

/**
 * Ask for the same sales several ways and report what came back.
 *
 * For when EMC answers 200 with an empty list: that is indistinguishable from
 * "no sales happened" unless you can compare interpretations side by side.
 * Deliberately does not throw, and reads only sale headers.
 */
export async function probeSales(
  cfg: GapConfig,
  store: GapStore,
  attempts: { label: string; params: Record<string, string> }[],
): Promise<SalesProbe[]> {
  return probeEndpoint(cfg, `/api/store/${store.id}/sales`, attempts)
}

/**
 * The same question of any endpoint: what does it answer, and in what shape?
 *
 * Undocumented APIs are learned by asking, and every guess this project has
 * made about Gap has been wrong at least once. Cheaper to look.
 */
export async function probeEndpoint(
  cfg: GapConfig,
  path: string,
  attempts: { label: string; params: Record<string, string>; method?: 'GET' | 'POST' }[],
): Promise<SalesProbe[]> {
  const out: SalesProbe[] = []

  for (const attempt of attempts) {
    const method = attempt.method ?? 'GET'
    const url = new URL(`${cfg.baseUrl}${path}`)
    // A POST carries its parameters in the body; a GET in the query string.
    if (method === 'GET') {
      for (const [k, v] of Object.entries(attempt.params)) url.searchParams.set(k, v)
    }

    try {
      const token = await (async () => {
        try {
          return await createToken(cfg)
        } catch {
          return null
        }
      })()
      if (!token) {
        out.push({ ...attempt, status: 0, shape: '-', count: 0, error: 'could not authenticate' })
        continue
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify(attempt.params) } : {}),
        cache: 'no-store',
      })

      if (!res.ok) {
        out.push({ ...attempt, status: res.status, shape: '-', count: 0, error: `HTTP ${res.status}` })
        continue
      }

      const body: unknown = await res.json()
      // The same extraction the real client uses, so the probe can never again
      // see rows the client cannot.
      const { rows, shape } = findRows(body)

      const first = rows[0] as Record<string, unknown> | undefined
      out.push({
        ...attempt,
        status: res.status,
        shape,
        count: rows.length,
        firstRowKeys: first ? Object.keys(first) : undefined,
        firstRow: first
          ? {
              saleHeaderID: first.saleHeaderID,
              saleIdentifier: first.saleIdentifier,
              storeID: first.storeID,
              tranType: first.tranType,
              totalAmount: first.totalAmount,
              created: first.created,
              createdLocal: first.createdLocal,
            }
          : undefined,
      })
    } catch (err) {
      out.push({
        ...attempt,
        status: 0,
        shape: '-',
        count: 0,
        error: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  return out
}

/** What one request asks for. EMC may cap it lower; the splitter copes. */
export const TAKE = 500

/**
 * Every sale in a window, however many there are.
 *
 * `Take` is a limit, not a promise of completeness, and EMC offers no
 * documented paging — the published help is an endpoint list with no schemas.
 * So when a request comes back full, assume it was cut off, halve the window
 * and ask again. Recursion bottoms out at two minutes.
 *
 * This matters more than it looks. Loganholme runs 50-60 sales an hour, the
 * nightly job uses a 25-hour window, and a trading day is 400-600 sales — so
 * a flat `Take=500` would quietly drop the tail of a busy day and report a
 * smaller number with no sign anything was missing. A silent undercount is
 * worse than an error, because nothing prompts anyone to look.
 *
 * Windows are inclusive at both ends, so halves overlap by an instant; results
 * are deduplicated on saleHeaderID.
 */
export async function getAllStoreSales(
  cfg: GapConfig,
  store: GapStore,
  opts: { start: Date; end: Date; onNote?: (note: string) => void },
): Promise<GapSaleHeader[]> {
  const MIN_WINDOW_MS = 2 * 60_000
  const MAX_DEPTH = 8

  const seen = new Map<number, GapSaleHeader>()

  async function walk(start: Date, end: Date, depth: number): Promise<void> {
    const rows = await getStoreSales(cfg, store, { start, end, take: TAKE })
    for (const r of rows) seen.set(r.saleHeaderID, r)

    if (rows.length < TAKE) return

    const span = end.getTime() - start.getTime()
    if (span <= MIN_WINDOW_MS || depth >= MAX_DEPTH) {
      // Two minutes of trade cannot really hold 500 sales, so this is a cap
      // we cannot see past rather than a genuinely busy window. Say so.
      opts.onNote?.(
        `still full at ${Math.round(span / 1000)}s from ${start.toISOString()} — sales may be missing`,
      )
      return
    }

    const mid = new Date(start.getTime() + Math.floor(span / 2))
    await walk(start, mid, depth + 1)
    await walk(mid, end, depth + 1)
  }

  await walk(opts.start, opts.end, 0)
  return [...seen.values()]
}

export async function getSaleDetail(cfg: GapConfig, saleHeaderID: number): Promise<GapSaleDetail> {
  return emcGet<GapSaleDetail>(cfg, `/api/storesale/${saleHeaderID}`)
}
