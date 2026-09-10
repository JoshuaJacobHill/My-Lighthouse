/**
 * Meta Conversions API — server-side purchase events for in-store sales.
 *
 * Separate from `integrations/meta.ts`, which reads ads and posts back out of
 * Meta. This only writes events in, and the two share nothing but a vendor.
 *
 * The rule that shapes this file: **no raw personal information ever leaves
 * here.** Email, phone and name are normalised and SHA-256 hashed in this
 * process, the raw values are dropped, and only digests go over the wire.
 *
 * Each normalisation is its own small function, documented with what Meta asks
 * for, because these requirements do change and a wrong one fails silently —
 * Meta accepts a badly normalised hash and simply never matches it to anyone.
 * A separate function per field is what makes that correctable later.
 *
 * No database imports, so the whole module is unit-testable.
 */

import { createHash } from 'node:crypto'

// ─── Config ───────────────────────────────────────────────────────────────────

export type CapiConfig = {
  baseUrl: string
  version: string
  datasetId: string
  token: string
  currency: string
  /** Present only while testing; absent means live events. */
  testEventCode?: string
}

export function capiConfig(): CapiConfig | null {
  const datasetId = process.env.META_DATASET_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN ?? process.env.META_ACCESS_TOKEN
  if (!datasetId || !token) return null

  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim()
  return {
    baseUrl: (process.env.META_GRAPH_BASE_URL ?? 'https://graph.facebook.com').replace(/\/+$/, ''),
    version: process.env.META_GRAPH_VERSION ?? 'v26.0',
    datasetId,
    token,
    currency: process.env.META_CURRENCY ?? 'AUD',
    // Empty string means "live", so it must not become an empty test code.
    testEventCode: testEventCode ? testEventCode : undefined,
  }
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

/** SHA-256 hex. Only ever called on an already-normalised value. */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Hash unless normalisation rejected the value, in which case send nothing. */
function hashed(normalised: string | null): string[] | undefined {
  return normalised ? [sha256(normalised)] : undefined
}

// ─── Normalisation, one field at a time ───────────────────────────────────────

/** Meta: trim, lowercase. Must still look like an address or it cannot match. */
export function normaliseEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase()
  if (!v) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

/**
 * Meta: digits only, including country code, no `+` and no leading zeros.
 *
 * Australian numbers arrive from the POS in every shape a person can type:
 * `0412 345 678`, `+61 412 345 678`, `(07) 3123 4567`, `61412345678`. All of
 * them have to end up as `61412345678` / `61731234567` or the hash matches
 * nobody. A number that is not recognisably Australian is dropped rather than
 * guessed at — a wrong hash is worse than no hash, because it looks like data.
 */
export function normalisePhoneAu(raw: string | null | undefined): string | null {
  const digits = raw?.replace(/\D/g, '') ?? ''
  if (!digits) return null

  // Already international.
  if (digits.startsWith('61') && digits.length === 11) return digits
  // 0061...
  if (digits.startsWith('0061') && digits.length === 13) return digits.slice(2)
  // Domestic with trunk zero: 0412345678 / 0731234567.
  if (digits.startsWith('0') && digits.length === 10) return `61${digits.slice(1)}`
  // Domestic without trunk zero: 412345678 / 731234567.
  if (digits.length === 9 && /^[234578]/.test(digits)) return `61${digits}`

  return null
}

/**
 * Meta: lowercase, no punctuation, no leading or trailing whitespace.
 *
 * Internal spaces and hyphens go too — "Mary-Jane" and "mary jane" have to
 * hash the same way as whatever Meta holds, and Meta strips them.
 */
export function normaliseName(raw: string | null | undefined): string | null {
  const v = raw
    ?.trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
  return v ? v : null
}

/** Meta: lowercase, no whitespace. Australian postcodes are four digits. */
export function normalisePostcode(raw: string | null | undefined): string | null {
  const v = raw?.replace(/\s+/g, '').toLowerCase()
  if (!v) return null
  return /^\d{4}$/.test(v) ? v : null
}

/** Meta: two-letter ISO 3166-1 alpha-2, lowercase. */
export function normaliseCountry(raw: string | null | undefined = 'AU'): string | null {
  const v = raw?.trim().toLowerCase()
  if (!v) return null
  return /^[a-z]{2}$/.test(v) ? v : null
}

// ─── User data ────────────────────────────────────────────────────────────────

/** Raw identifiers, as read from EMC. Never stored, never logged. */
export type RawIdentifiers = {
  email?: string | null
  mobile?: string | null
  givenName?: string | null
  familyName?: string | null
  postalCode?: string | null
  country?: string | null
}

export type HashedUserData = {
  em?: string[]
  ph?: string[]
  fn?: string[]
  ln?: string[]
  zp?: string[]
  country?: string[]
}

/**
 * Turn raw identifiers into hashes.
 *
 * The country default is AU rather than blank: every one of these sales
 * happened over a counter in Logan.
 */
export function buildUserData(raw: RawIdentifiers): HashedUserData {
  const out: HashedUserData = {
    em: hashed(normaliseEmail(raw.email)),
    ph: hashed(normalisePhoneAu(raw.mobile)),
    fn: hashed(normaliseName(raw.givenName)),
    ln: hashed(normaliseName(raw.familyName)),
    zp: hashed(normalisePostcode(raw.postalCode)),
    country: hashed(normaliseCountry(raw.country ?? 'AU')),
  }
  // Drop the empty keys so a sparse customer doesn't send a payload of nulls.
  for (const k of Object.keys(out) as (keyof HashedUserData)[]) {
    if (!out[k]) delete out[k]
  }
  return out
}

/**
 * Whether there is anything Meta could actually match on.
 *
 * `country` alone is not a match — everyone shopping in Loganholme is in
 * Australia — so it is excluded from the test on purpose.
 */
export function isMatchable(user: HashedUserData): boolean {
  return Boolean(user.em || user.ph || (user.fn && user.ln && user.zp))
}

// ─── Payload ──────────────────────────────────────────────────────────────────

export type PurchaseInput = {
  /** EMC's saleIdentifier — the whole deduplication story depends on it. */
  saleIdentifier: string
  /** The real transaction instant. */
  occurredAt: Date
  /** Cents, as EMC reports it. */
  totalCents: number
  userData: HashedUserData
}

export type CapiPayload = {
  data: {
    event_name: 'Purchase'
    event_time: number
    event_id: string
    action_source: 'physical_store'
    user_data: HashedUserData
    custom_data: { currency: string; value: number; order_id: string }
  }[]
  test_event_code?: string
}

/** Cents to dollars. 7194 → 71.94, and never 71.94000000000001. */
export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100
}

export function buildPurchasePayload(input: PurchaseInput, cfg: CapiConfig): CapiPayload {
  const payload: CapiPayload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(input.occurredAt.getTime() / 1000),
        // Stable across every retry, which is what stops Meta double-counting.
        event_id: input.saleIdentifier,
        action_source: 'physical_store',
        user_data: input.userData,
        custom_data: {
          currency: cfg.currency,
          value: centsToAmount(input.totalCents),
          order_id: input.saleIdentifier,
        },
      },
    ],
  }
  // Present only when configured — this is the switch between Test Events and
  // live, and it must not appear as an empty string.
  if (cfg.testEventCode) payload.test_event_code = cfg.testEventCode
  return payload
}

// ─── Sending ──────────────────────────────────────────────────────────────────

export type CapiResult =
  | { ok: true; eventsReceived: number; fbtraceId?: string }
  | { ok: false; status: number; error: string; fbtraceId?: string; retryable: boolean }

type CapiResponse = {
  events_received?: number
  fbtrace_id?: string
  error?: { message?: string; code?: number; type?: string }
}

const MAX_SEND_ATTEMPTS = 4
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Post events, retrying only what is worth retrying.
 *
 * Success is deliberately stricter than "HTTP 200": Meta answers 200 with
 * `events_received: 0` when it has quietly dropped everything, and marking
 * such a sale as sent would lose it for good.
 */
export async function sendEvents(payload: CapiPayload, cfg: CapiConfig): Promise<CapiResult> {
  const url = `${cfg.baseUrl}/${cfg.version}/${cfg.datasetId}/events`

  let last: CapiResult = { ok: false, status: 0, error: 'not attempted', retryable: true }

  for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1))

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.token}`,
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      })
    } catch (err) {
      // Network failure: worth another go.
      last = { ok: false, status: 0, error: err instanceof Error ? err.message : 'network error', retryable: true }
      continue
    }

    const json = (await res.json().catch(() => ({}))) as CapiResponse

    if (res.ok && (json.events_received ?? 0) >= 1) {
      return { ok: true, eventsReceived: json.events_received!, fbtraceId: json.fbtrace_id }
    }

    const retryable = res.status === 429 || res.status >= 500
    last = {
      ok: false,
      status: res.status,
      error: json.error?.message ?? `events_received=${json.events_received ?? 0}`,
      fbtraceId: json.fbtrace_id,
      retryable,
    }

    // A 400 is a payload or token problem. Retrying it just repeats the mistake.
    if (!retryable) return last
  }

  return last
}
