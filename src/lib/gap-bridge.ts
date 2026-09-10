/**
 * The bridge: Gap Solutions EMC → our ledger → Meta Conversions API.
 *
 *   GET /api/store/{id}/sales        a window of completed sales
 *     → GapSale                      recorded once, keyed on saleIdentifier
 *     → GET /api/storesale/{id}      only for sales we might send
 *     → hash identifiers in memory   raw values discarded immediately
 *     → POST .../{dataset}/events    Meta, with the sale identifier as event_id
 *     → GapSale.status = SENT        only after Meta acknowledges it
 *     → SalesFact                    the in-store half of the sales report
 *
 * Three properties matter more than anything else here:
 *
 *  1. **Nothing is sent twice.** `saleIdentifier` is unique in the database and
 *     is also the Meta `event_id`, so even a duplicate send would deduplicate
 *     at Meta's end. Belt and braces, because double-counted revenue would
 *     quietly corrupt ad optimisation rather than fail visibly.
 *  2. **Nothing is marked sent that wasn't.** Only an acknowledged event with
 *     `events_received >= 1` writes SENT. Everything else stays retryable.
 *  3. **No personal information is stored.** Identifiers are read, hashed and
 *     dropped inside one function. Payment, card, EFTPOS, operator and basket
 *     detail are never read at all.
 *
 * The window overlaps deliberately (an hour by default, every ten minutes) so a
 * missed run, a slow EMC or a redeploy cannot lose a sale. Deduplication is
 * what makes overlap free.
 */

import prisma from '@/lib/prisma'
import { GapSaleStatus, SalesChannel } from '@prisma/client'
import { brisbaneToday, calendarDay, calendarDayString } from '@/lib/fitness-days'
import {
  type GapConfig,
  type GapSaleHeader,
  type GapStore,
  gapConfig,
  BRISBANE_OFFSET_MINUTES,
  getAllStoreSales,
  getSaleDetail,
  isExternalSale,
  hasRealCustomer,
  saleInstant,
  probeEndpoint,
  probeSales,
  toEmcDateParam,
  toUtcDateParam,
  type SalesProbe,
  GapError,
} from '@/lib/integrations/gap'
import {
  type CapiConfig,
  type HashedUserData,
  buildPurchasePayload,
  buildUserData,
  capiConfig,
  centsToAmount,
  isMatchable,
  normaliseEmail,
  normaliseName,
  normalisePhoneAu,
  normalisePostcode,
  sendEvents,
} from '@/lib/integrations/meta-capi'

// ─── Switches ─────────────────────────────────────────────────────────────────

/** Where a sale came from, for SalesFact's composite key. */
export const GAP_SOURCE = 'gap-solutions'
/** IngestRun.source, so the bridge appears in the report's health panel. */
export const RUN_SOURCE = 'gap-meta-bridge'

const flag = (name: string, fallback: boolean): boolean => {
  const v = process.env[name]?.trim().toLowerCase()
  if (v === undefined || v === '') return fallback
  return v === 'true' || v === '1'
}

/**
 * How far back a scheduled run looks.
 *
 * Twenty-five hours, not one, because the Vercel plan allows a single daily
 * cron rather than the ten-minute poll this was designed for. One run a day
 * with a day-wide window is still correct — deduplication means the overlap
 * costs nothing, and Meta accepts in-store events up to seven days old, so
 * attribution is unaffected. It is only less timely.
 *
 * On Vercel Pro, set the cron to `*​/10 * * * *` and POLL_LOOKBACK_MINUTES=60
 * and it polls as intended, with no code change.
 */
const DEFAULT_LOOKBACK_MINUTES = 25 * 60

export type BridgeSettings = {
  /** Fetch, inspect, build the payload — but post nothing to Meta. */
  dryRun: boolean
  /**
   * Whether hashed customer identifiers may be sent at all.
   *
   * Off by default and on purpose. It should only be turned on once Lighthouse
   * Care has confirmed its privacy notice covers using hashed customer
   * identifiers with Meta for advertising measurement. An unticked marketing
   * box in the POS is NOT that confirmation — it is about being emailed.
   */
  sendIdentifiers: boolean
  lookbackMinutes: number
  /** Give up retrying a sale after this many failed attempts. */
  maxAttempts: number
  /**
   * How old an event can be and still be worth offering to Meta.
   *
   * Meta rejects events much older than a week, so fetching the customer for
   * a sale from last month buys nothing — and it is the detail request, one
   * per sale, that makes a run slow. Skipping it is what turns a month-long
   * backfill from hours into a couple of minutes: history lands in the sales
   * report at full speed and is never offered to Meta at all.
   */
  maxEventAgeDays: number
  /**
   * Detail requests allowed in one run.
   *
   * A bound, not a target. Whatever is left stays PENDING and is picked up by
   * the next run, so a busy day cannot make a single run take longer than the
   * function is allowed to live. The sales report does not wait for any of
   * this — it is built from headers, which are already recorded.
   */
  detailBudget: number
}

export function bridgeSettings(): BridgeSettings {
  return {
    dryRun: flag('DRY_RUN', true),
    sendIdentifiers: flag('SEND_CUSTOMER_IDENTIFIERS', false),
    lookbackMinutes: Number(process.env.POLL_LOOKBACK_MINUTES) || DEFAULT_LOOKBACK_MINUTES,
    maxAttempts: Number(process.env.GAP_MAX_ATTEMPTS ?? 6),
    maxEventAgeDays: Number(process.env.META_MAX_EVENT_AGE_DAYS) || 7,
    detailBudget: Number(process.env.GAP_DETAIL_BUDGET) || 150,
  }
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/**
 * Structured, and allow-listed rather than redacted.
 *
 * Redacting means remembering to name every sensitive field; allow-listing
 * means a new field in EMC's response cannot leak by being forgotten. Nothing
 * reaches the log unless it is one of these keys.
 */
type LogFields = {
  event: string
  saleHeaderID?: number
  saleIdentifier?: string
  storeID?: number
  tranType?: number
  valueAud?: number
  occurredAt?: string
  timeSource?: string
  status?: string
  matchKeys?: string
  metaStatus?: number
  eventsReceived?: number
  fbtraceId?: string
  reason?: string
  attempt?: number
  dryRun?: boolean
  count?: number
}

function log(fields: LogFields): void {
  console.log(JSON.stringify({ svc: 'gap-meta-bridge', ...fields }))
}

// ─── One sale ─────────────────────────────────────────────────────────────────

export type SaleOutcome = {
  saleIdentifier: string
  status: GapSaleStatus
  reason?: string
  /** Which hashed keys were built, e.g. "em,ph,fn,ln,zp". Never values. */
  matchKeys?: string
  valueAud: number
}

/**
 * Read the customer, hash what Meta can use, and drop the raw values.
 *
 * Scoped to one function so the raw identifiers cannot escape it: what comes
 * back out is hashes and a list of which fields were populated.
 */
function hashCustomer(detail: Awaited<ReturnType<typeof getSaleDetail>>): {
  user: HashedUserData
  matchKeys: string
} {
  const c = detail.customer
  const user = buildUserData({
    email: c?.email,
    mobile: c?.mobile,
    givenName: c?.givenName,
    familyName: c?.familyName,
    postalCode: c?.postalCode,
    country: 'AU',
    externalId: detail.customerGuid,
  })
  return { user, matchKeys: Object.keys(user).join(',') }
}

/** Whether a sale we already hold is worth looking at again. */
export function shouldReprocess(
  existing: { status: GapSaleStatus; attemptCount: number } | null,
  settings: BridgeSettings,
): boolean {
  if (!existing) return true
  switch (existing.status) {
    case GapSaleStatus.SENT:
      // The whole point. Never again.
      return false
    case GapSaleStatus.SKIPPED_NO_CUSTOMER:
    case GapSaleStatus.SKIPPED_TRAN_TYPE:
    case GapSaleStatus.SKIPPED_TOO_OLD:
      // An anonymous sale stays anonymous; do not reconsider it every ten
      // minutes for the rest of the month.
      return false
    case GapSaleStatus.SKIPPED_IDENTIFIERS_OFF:
      // Worth another look only once the switch has been turned on.
      return settings.sendIdentifiers
    case GapSaleStatus.FAILED:
      return existing.attemptCount < settings.maxAttempts
    case GapSaleStatus.PENDING:
      return true
  }
}

/**
 * Record a sale header and, where it qualifies, send it to Meta.
 *
 * Returns what happened and why. Never throws for a single sale's sake — one
 * awkward transaction must not stop the run.
 */
export async function processSale(
  header: GapSaleHeader,
  cfg: GapConfig,
  store: GapStore,
  capi: CapiConfig | null,
  settings: BridgeSettings,
  /**
   * Inspect a sale the ledger has already settled.
   *
   * For the manual test only. Without it, testing a recorded sale returns
   * "already_settled" before the customer is ever read — so the one thing the
   * test is for, showing which fields Meta could match on, never appears.
   * It forces inspection, never a re-send: a sale already sent is still not
   * sent again.
   */
  opts?: {
    force?: boolean
    /**
     * Record the sale but do not fetch its customer.
     *
     * Used once a run has spent its detail budget. The row still counts
     * towards the sales report; it stays PENDING and the next run finishes it.
     */
    skipDetail?: boolean
  },
): Promise<SaleOutcome> {
  const valueAud = centsToAmount(header.totalAmount)
  const instant = saleInstant(header)
  const at = instant?.at ?? new Date()
  const dayString = brisbaneToday(at)
  const day = calendarDay(dayString)!

  const base = {
    saleHeaderID: header.saleHeaderID,
    saleIdentifier: header.saleIdentifier,
    storeID: header.storeID,
    tranType: header.tranType,
    itemCount: header.itemCount ?? null,
    totalCents: header.totalAmount,
    occurredAt: at,
    day,
    isExternal: isExternalSale(header),
    inspectedAt: new Date(),
  }

  const existing = await prisma.gapSale.findUnique({
    where: { saleIdentifier: header.saleIdentifier },
    select: { status: true, attemptCount: true, isExternal: true },
  })

  if (!shouldReprocess(existing, settings) && !opts?.force) {
    // Settled for Meta, but the report still reads this row. Keeping the
    // structural facts current costs one cheap write and no detail request —
    // and means a newly added column fills itself in on the next run instead
    // of needing a backfill.
    if (existing!.isExternal !== base.isExternal) {
      await prisma.gapSale.update({
        where: { saleIdentifier: header.saleIdentifier },
        data: { isExternal: base.isExternal },
      })
    }
    return { saleIdentifier: header.saleIdentifier, status: existing!.status, reason: 'already_settled', valueAud }
  }

  // Anything that is not a normal completed sale is recorded and left alone.
  // Refunds and unusual transaction types are a separate piece of thinking and
  // inventing rules for them here would be guessing.
  if (header.tranType !== 0 || header.storeID !== store.id) {
    await upsert(base, GapSaleStatus.SKIPPED_TRAN_TYPE, { hasCustomer: false })
    const reason = header.storeID !== store.id ? 'other_store' : `tran_type_${header.tranType}`
    log({ event: 'skipped', ...ids(header), reason, status: 'SKIPPED_TRAN_TYPE' })
    return { saleIdentifier: header.saleIdentifier, status: GapSaleStatus.SKIPPED_TRAN_TYPE, reason, valueAud }
  }

  // Too old for Meta to accept, so the customer is not worth fetching. The
  // sale still counts towards the report — this is exactly what makes a
  // backfill of months of history cheap rather than an afternoon of requests.
  const ageDays = (Date.now() - at.getTime()) / 86_400_000
  if (ageDays > settings.maxEventAgeDays) {
    await upsert(base, GapSaleStatus.SKIPPED_TOO_OLD, { hasCustomer: false })
    return {
      saleIdentifier: header.saleIdentifier,
      status: GapSaleStatus.SKIPPED_TOO_OLD,
      reason: `${Math.floor(ageDays)} days old`,
      valueAud,
    }
  }

  // Out of detail requests for this run. Record it and let the next one finish.
  if (opts?.skipDetail) {
    await upsert(base, GapSaleStatus.PENDING, { hasCustomer: false })
    return {
      saleIdentifier: header.saleIdentifier,
      status: GapSaleStatus.PENDING,
      reason: 'detail_budget_spent',
      valueAud,
    }
  }

  // Only now is the detail worth fetching — it is a request per sale, and it is
  // the response that carries information we would rather not even receive.
  const detail = await getSaleDetail(cfg, header.saleHeaderID)

  if (!hasRealCustomer(detail)) {
    await upsert(base, GapSaleStatus.SKIPPED_NO_CUSTOMER, { hasCustomer: false })
    log({ event: 'skipped', ...ids(header), reason: 'no_matchable_customer', status: 'SKIPPED_NO_CUSTOMER' })
    return {
      saleIdentifier: header.saleIdentifier,
      status: GapSaleStatus.SKIPPED_NO_CUSTOMER,
      reason: 'no_matchable_customer',
      valueAud,
    }
  }

  const { user, matchKeys } = hashCustomer(detail)

  if (!isMatchable(user)) {
    await upsert(base, GapSaleStatus.SKIPPED_NO_CUSTOMER, { hasCustomer: true })
    log({ event: 'skipped', ...ids(header), reason: 'no_usable_identifiers', status: 'SKIPPED_NO_CUSTOMER' })
    return {
      saleIdentifier: header.saleIdentifier,
      status: GapSaleStatus.SKIPPED_NO_CUSTOMER,
      reason: 'no_usable_identifiers',
      valueAud,
    }
  }

  // The privacy switch. The sale is still recorded — it counts towards the
  // sales report — but no identifiers go anywhere.
  if (!settings.sendIdentifiers) {
    await upsert(base, GapSaleStatus.SKIPPED_IDENTIFIERS_OFF, { hasCustomer: true })
    log({ event: 'skipped', ...ids(header), reason: 'identifiers_disabled', matchKeys, status: 'SKIPPED_IDENTIFIERS_OFF' })
    return {
      saleIdentifier: header.saleIdentifier,
      status: GapSaleStatus.SKIPPED_IDENTIFIERS_OFF,
      reason: 'identifiers_disabled',
      matchKeys,
      valueAud,
    }
  }

  // Reached only when forcing, and the one thing forcing must never do.
  if (existing?.status === GapSaleStatus.SENT) {
    return {
      saleIdentifier: header.saleIdentifier,
      status: GapSaleStatus.SENT,
      reason: 'already_sent — not sent again',
      matchKeys,
      valueAud,
    }
  }

  if (!capi) {
    await upsert(base, GapSaleStatus.PENDING, { hasCustomer: true })
    return { saleIdentifier: header.saleIdentifier, status: GapSaleStatus.PENDING, reason: 'meta_not_configured', valueAud }
  }

  const payload = buildPurchasePayload(
    {
      saleIdentifier: header.saleIdentifier,
      occurredAt: at,
      totalCents: header.totalAmount,
      userData: user,
    },
    capi,
  )

  if (settings.dryRun) {
    await upsert(base, GapSaleStatus.PENDING, { hasCustomer: true })
    log({
      event: 'dry_run',
      ...ids(header),
      valueAud,
      occurredAt: at.toISOString(),
      timeSource: instant?.source,
      matchKeys,
      dryRun: true,
    })
    return { saleIdentifier: header.saleIdentifier, status: GapSaleStatus.PENDING, reason: 'dry_run', matchKeys, valueAud }
  }

  const result = await sendEvents(payload, capi)

  if (result.ok) {
    await upsert(base, GapSaleStatus.SENT, { hasCustomer: true, sentAt: new Date(), lastError: null })
    log({
      event: 'sent',
      ...ids(header),
      valueAud,
      occurredAt: at.toISOString(),
      matchKeys,
      eventsReceived: result.eventsReceived,
      fbtraceId: result.fbtraceId,
    })
    return { saleIdentifier: header.saleIdentifier, status: GapSaleStatus.SENT, matchKeys, valueAud }
  }

  await upsert(base, GapSaleStatus.FAILED, {
    hasCustomer: true,
    lastError: `${result.status}: ${result.error}`.slice(0, 500),
    bumpAttempt: true,
  })
  log({
    event: 'failed',
    ...ids(header),
    valueAud,
    matchKeys,
    metaStatus: result.status,
    fbtraceId: result.fbtraceId,
    reason: result.error,
  })
  return { saleIdentifier: header.saleIdentifier, status: GapSaleStatus.FAILED, reason: result.error, matchKeys, valueAud }
}

function ids(h: GapSaleHeader) {
  return { saleHeaderID: h.saleHeaderID, saleIdentifier: h.saleIdentifier, storeID: h.storeID, tranType: h.tranType }
}

type UpsertExtras = {
  hasCustomer: boolean
  sentAt?: Date
  lastError?: string | null
  bumpAttempt?: boolean
}

async function upsert(
  base: {
    saleHeaderID: number
    saleIdentifier: string
    storeID: number
    tranType: number
    itemCount: number | null
    totalCents: number
    occurredAt: Date
    day: Date
    inspectedAt: Date
  },
  status: GapSaleStatus,
  extras: UpsertExtras,
): Promise<void> {
  const common = {
    status,
    hasCustomer: extras.hasCustomer,
    ...(extras.sentAt ? { sentAt: extras.sentAt } : {}),
    ...(extras.lastError !== undefined ? { lastError: extras.lastError } : {}),
  }

  await prisma.gapSale.upsert({
    where: { saleIdentifier: base.saleIdentifier },
    create: {
      ...base,
      ...common,
      attemptCount: extras.bumpAttempt ? 1 : 0,
    },
    update: {
      ...base,
      ...common,
      ...(extras.bumpAttempt ? { attemptCount: { increment: 1 } } : {}),
    },
  })
}

// ─── The sales report rollup ──────────────────────────────────────────────────

/**
 * Recompute SalesFact for the days we touched.
 *
 * Recomputed from the ledger rather than incremented, so it is idempotent and
 * self-healing: a re-run, a backfill or a late-arriving sale all converge on
 * the right number instead of adding to a total twice.
 *
 * Channel is IN_STORE because that is what a Gap till is. Click-and-collect and
 * home delivery come from MyFoodLink under their own source, and the composite
 * key keeps the two feeds from overwriting each other.
 */
export async function rollUpSalesFacts(store: GapStore, days: Date[]): Promise<number> {
  if (days.length === 0) return 0

  const grouped = await prisma.gapSale.groupBy({
    by: ['day', 'isExternal'],
    where: {
      day: { in: days },
      storeID: store.id,
      tranType: 0,
    },
    _sum: { totalCents: true },
    _count: { _all: true },
  })

  for (const row of grouped) {
    const channel = row.isExternal ? SalesChannel.ONLINE : SalesChannel.IN_STORE
    await prisma.salesFact.upsert({
      where: {
        day_store_channel_source: {
          day: row.day,
          store: store.name,
          channel,
          source: GAP_SOURCE,
        },
      },
      create: {
        day: row.day,
        store: store.name,
        channel,
        source: GAP_SOURCE,
        orders: row._count._all,
        revenueCents: row._sum.totalCents ?? 0,
      },
      update: {
        orders: row._count._all,
        revenueCents: row._sum.totalCents ?? 0,
      },
    })
  }

  // A day that had online sales and then does not must fall back to zero, or
  // yesterday's figure sits there looking like today's.
  const days_ = [...new Set(grouped.map((g) => g.day.getTime()))]
  for (const t of days_) {
    for (const channel of [SalesChannel.IN_STORE, SalesChannel.ONLINE]) {
      const present = grouped.some(
        (g) => g.day.getTime() === t && (g.isExternal ? SalesChannel.ONLINE : SalesChannel.IN_STORE) === channel,
      )
      if (present) continue
      await prisma.salesFact.updateMany({
        where: { day: new Date(t), store: store.name, channel, source: GAP_SOURCE },
        data: { orders: 0, revenueCents: 0 },
      })
    }
  }

  return new Set(grouped.map((g) => g.day.getTime())).size
}

// ─── Backfilling history ──────────────────────────────────────────────────────

export type BackfillResult = {
  /** yyyy-mm-dd of the next day to do, or null when finished. */
  nextDay: string | null
  daysDone: number
  salesCounted: number
  revenueCents: number
  /** Days left to the ledger because it already holds them. */
  skippedToLedger: number
}

/**
 * Fill the sales report with history, without filling the ledger.
 *
 * A year of trade is roughly 300,000 sales. Writing a GapSale row for each
 * would take hours and buy nothing: the ledger exists to stop Meta being sent
 * the same event twice, and Meta will not accept an event from last March at
 * all. What the report actually needs is four numbers a day per store — sales
 * and revenue, in store and online — so that is all this writes.
 *
 * Which makes a year affordable: about two requests per store per day instead
 * of a row per sale, and no customer detail fetched at any point.
 *
 * A day the ledger already covers is left alone. The two must never both own
 * a day, or a full run and a partial one would take turns overwriting each
 * other's total.
 *
 * Done in chunks because a serverless function has a minute to live. The
 * caller loops on `nextDay`.
 */
export async function backfillDays(opts: {
  /** Oldest day still to do, yyyy-mm-dd. */
  fromDay: string
  /** How many days this call should attempt. */
  days: number
}): Promise<{ ok: false; error: string } | ({ ok: true } & BackfillResult)> {
  const cfg = gapConfig()
  if (!cfg) return { ok: false, error: 'EMC credentials or stores not configured' }

  const first = calendarDay(opts.fromDay)
  if (!first) return { ok: false, error: `"${opts.fromDay}" is not a date.` }

  const todayString = brisbaneToday()
  const today = calendarDay(todayString)!

  let daysDone = 0
  let salesCounted = 0
  let revenueCents = 0
  let skippedToLedger = 0
  let cursor = first

  for (let i = 0; i < Math.max(1, opts.days); i++) {
    if (cursor.getTime() >= today.getTime()) {
      // Today belongs to the live run, which has the detail and the ledger.
      return { ok: true, nextDay: null, daysDone, salesCounted, revenueCents, skippedToLedger }
    }

    // Brisbane midnight to midnight, as instants.
    const start = new Date(cursor.getTime() - BRISBANE_OFFSET_MINUTES * 60_000)
    const end = new Date(start.getTime() + 86_399_999)

    for (const store of cfg.stores) {
      const alreadyOurs = await prisma.gapSale.count({
        where: { day: cursor, storeID: store.id },
      })
      if (alreadyOurs > 0) {
        skippedToLedger++
        continue
      }

      const headers = await getAllStoreSales(cfg, store, { start, end })
      const counted = headers.filter((h) => h.tranType === 0 && h.storeID === store.id)

      for (const channel of [SalesChannel.IN_STORE, SalesChannel.ONLINE]) {
        const rows = counted.filter(
          (h) => (isExternalSale(h) ? SalesChannel.ONLINE : SalesChannel.IN_STORE) === channel,
        )
        const revenue = rows.reduce((n, h) => n + h.totalAmount, 0)

        // Written even when zero, so an empty day reads as "we looked and
        // there was nothing" rather than as a gap in the data.
        await prisma.salesFact.upsert({
          where: {
            day_store_channel_source: { day: cursor, store: store.name, channel, source: GAP_SOURCE },
          },
          create: {
            day: cursor,
            store: store.name,
            channel,
            source: GAP_SOURCE,
            orders: rows.length,
            revenueCents: revenue,
          },
          update: { orders: rows.length, revenueCents: revenue },
        })

        salesCounted += rows.length
        revenueCents += revenue
      }
    }

    daysDone++
    cursor = new Date(cursor.getTime() + 86_400_000)
  }

  const nextDay = cursor.getTime() >= today.getTime() ? null : calendarDayString(cursor)
  return { ok: true, nextDay, daysDone, salesCounted, revenueCents, skippedToLedger }
}

// ─── A run ────────────────────────────────────────────────────────────────────

export type RunSummary = {
  ok: boolean
  skippedRun?: 'already_running' | 'not_configured'
  windowStart?: string
  windowEnd?: string
  inspected: number
  sent: number
  skipped: number
  failed: number
  daysRolledUp: number
  /** Set when EMC's row cap could not be worked around — sales may be missing. */
  notes?: string[]
  dryRun: boolean
  sendIdentifiers: boolean
  testEventCode: boolean
  error?: string
}

/**
 * One polling cycle. Safe to call from the cron, from the admin console, or by
 * hand — which is the reason it is a plain function rather than route logic.
 */
export async function runOnce(opts?: { lookbackMinutes?: number }): Promise<RunSummary> {
  const settings = bridgeSettings()
  const cfg = gapConfig()
  const capi = capiConfig()

  const empty: RunSummary = {
    ok: false,
    inspected: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    daysRolledUp: 0,
    dryRun: settings.dryRun,
    sendIdentifiers: settings.sendIdentifiers,
    testEventCode: Boolean(capi?.testEventCode),
  }

  if (!cfg) {
    log({
      event: 'not_configured',
      reason: 'EMC_BASE_URL, EMC_EMAIL, EMC_PASSWORD or a EMC_<STORE>_STORE_ID is missing',
    })
    return { ...empty, skippedRun: 'not_configured', error: 'EMC credentials or stores not configured' }
  }

  // Overlapping runs would double the EMC load and race on the same rows. The
  // window is generous rather than exact — a stuck run should not block the
  // bridge for the rest of the day.
  const inFlight = await prisma.ingestRun.findFirst({
    where: {
      source: RUN_SOURCE,
      finishedAt: null,
      startedAt: { gt: new Date(Date.now() - 20 * 60_000) },
    },
    select: { id: true },
  })
  if (inFlight) {
    log({ event: 'skipped_overlapping_run' })
    return { ...empty, skippedRun: 'already_running' }
  }

  const run = await prisma.ingestRun.create({ data: { source: RUN_SOURCE } })

  const lookback = opts?.lookbackMinutes ?? settings.lookbackMinutes
  const end = new Date()
  const start = new Date(end.getTime() - lookback * 60_000)

  let inspected = 0
  let sent = 0
  let skipped = 0
  let failed = 0
  let daysRolledUp = 0
  let detailBudget = settings.detailBudget
  let deferred = 0
  const notes: string[] = []

  try {
    // Every configured store, in one run. They share the token and the window;
    // the rollup is per store because SalesFact is keyed by store name.
    for (const store of cfg.stores) {
      const days = new Set<string>()
      const headers = await getAllStoreSales(cfg, store, {
        start,
        end,
        onNote: (note) => {
          notes.push(`${store.name}: ${note}`)
          log({ event: 'possible_truncation', storeID: store.id, reason: note })
        },
      })
      log({ event: 'fetched', count: headers.length, storeID: store.id })

      for (const header of headers) {
        inspected++
        try {
          const outcome = await processSale(header, cfg, store, capi, settings, {
            skipDetail: detailBudget <= 0,
          })
          // Only a fetched detail costs anything; everything else is free.
          if (outcome.reason === 'detail_budget_spent') deferred++
          else if (
            outcome.status !== GapSaleStatus.SKIPPED_TRAN_TYPE &&
            outcome.status !== GapSaleStatus.SKIPPED_TOO_OLD &&
            outcome.reason !== 'already_settled'
          ) {
            detailBudget--
          }
          if (outcome.status === GapSaleStatus.SENT) sent++
          else if (outcome.status === GapSaleStatus.FAILED) failed++
          else if (outcome.status !== GapSaleStatus.PENDING) skipped++

          const at = saleInstant(header)?.at
          if (at) days.add(brisbaneToday(at))
        } catch (err) {
          failed++
          // A 403 means the integration account has lost a permission. That is
          // worth stopping for; grinding through 200 sales to fail each one
          // individually only buries the message.
          if (err instanceof GapError && err.permanent) throw err
          log({
            event: 'sale_error',
            saleHeaderID: header.saleHeaderID,
            reason: err instanceof Error ? err.message : 'unknown error',
          })
        }
      }

      const dayValues = [...days].map((d) => calendarDay(d)).filter((d): d is Date => d !== null)
      daysRolledUp += await rollUpSalesFacts(store, dayValues)
    }

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, rows: inspected },
    })

    log({ event: 'run_complete', count: inspected, dryRun: settings.dryRun })

    return {
      ...empty,
      ok: true,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      inspected,
      sent,
      skipped,
      failed,
      daysRolledUp,
      ...(deferred > 0
        ? {
            notes: [
              ...notes,
              `${deferred} sales recorded but not yet offered to Meta — the next run will finish them`,
            ],
          }
        : notes.length > 0
          ? { notes }
          : {}),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, rows: inspected, error: message.slice(0, 500) },
    })
    log({ event: 'run_failed', reason: message })
    return {
      ...empty,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      inspected,
      sent,
      skipped,
      failed,
      error: message,
    }
  }
}

// ─── One sale, by hand ────────────────────────────────────────────────────────

/**
 * Test a single known sale end to end.
 *
 * Uses the same `processSale` as the poll, including persistence, so a sale
 * tested here cannot be sent again by the next cycle. The header is rebuilt
 * from the detail response, which is the one place this bridge reads a sale it
 * did not first see in a window.
 */
export async function processOneSale(saleHeaderID: number): Promise<
  | { ok: true; outcome: SaleOutcome; dryRun: boolean }
  | { ok: false; error: string }
> {
  const settings = bridgeSettings()
  const cfg = gapConfig()
  if (!cfg) return { ok: false, error: 'EMC credentials not configured' }
  const capi = capiConfig()

  try {
    const detail = (await getSaleDetail(cfg, saleHeaderID)) as Record<string, unknown> & {
      saleHeaderID: number
    }

    const header: GapSaleHeader = {
      saleHeaderID: detail.saleHeaderID ?? saleHeaderID,
      saleIdentifier: String(detail.saleIdentifier ?? ''),
      storeID: Number(detail.storeID ?? cfg.stores[0].id),
      tranType: Number(detail.tranType ?? 0),
      itemCount: typeof detail.itemCount === 'number' ? detail.itemCount : undefined,
      totalAmount: Number(detail.totalAmount ?? 0),
      created: typeof detail.created === 'string' ? detail.created : undefined,
      createdLocal: typeof detail.createdLocal === 'string' ? detail.createdLocal : undefined,
    }

    if (!header.saleIdentifier) {
      return { ok: false, error: 'That sale has no saleIdentifier, so it cannot be deduplicated safely.' }
    }

    // Match the sale to a configured store rather than assuming the first one,
    // or a Hillcrest sale would be rolled into Loganholme's takings.
    const store = cfg.stores.find((s) => s.id === header.storeID)
    if (!store) {
      return {
        ok: false,
        error: `Sale ${saleHeaderID} belongs to store ${header.storeID}, which is not configured. Add EMC_<NAME>_STORE_ID for it.`,
      }
    }

    const outcome = await processSale(header, cfg, store, capi, settings, { force: true })
    return { ok: true, outcome, dryRun: settings.dryRun }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown error' }
  }
}

// ─── Match coverage ───────────────────────────────────────────────────────────

export type FieldCoverage = {
  key: string
  label: string
  /** The POS had something in this field. */
  present: number
  /** And it survived normalisation, so Meta can match on it. */
  usable: number
  /** Why the rest were rejected, so it can be fixed at the counter. */
  reasons: { reason: string; count: number }[]
}

/**
 * Why a value could not be used, without repeating the value.
 *
 * "Tidy it at the POS end" is useless advice if nobody can say what to tidy.
 * A reason is the difference between that and "three numbers have a note typed
 * after them". Deliberately describes the shape, never the content.
 */
function phoneRejection(raw: string): string {
  if (/[a-z]/i.test(raw)) return 'has letters or a note typed in with it'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return 'no digits at all'
  if (digits.length < 9) return `too short (${digits.length} digits)`
  if (digits.length > 11) return `too long (${digits.length} digits)`
  return 'not a recognisable Australian number'
}

function postcodeRejection(raw: string): string {
  const v = raw.replace(/\s+/g, '')
  if (/[a-z]/i.test(v)) return 'has letters in it'
  return `not four digits (${v.length} characters)`
}

export type Coverage = {
  sampled: number
  withCustomer: number
  /** Enough for Meta to match: an email, a phone, or name plus postcode. */
  matchable: number
  fields: FieldCoverage[]
  /**
   * Every field name EMC's customer record carries, and which of them held a
   * value. Names only — never contents.
   *
   * Here so the next parameter worth adding (city and state would strengthen
   * the name-plus-postcode match) can be read off rather than guessed at. The
   * last thing we guessed at was the key holding the sales list, and that cost
   * an afternoon.
   */
  customerFields: { name: string; filled: number }[]
}

/**
 * What customer data is actually in there, and how much of it Meta could use.
 *
 * The distinction that matters is **present** versus **usable**. A phone number
 * the POS holds as "0412 345 678 (mob)" is present and unusable: normalisation
 * rejects it, we send no `ph`, and nothing anywhere says so. Counting both
 * turns that from an invisible shortfall into a number.
 *
 * Reads customer fields to test them and discards them — nothing is stored,
 * nothing is logged, and the result is counts only. Capped, because it costs
 * one EMC detail request per sale.
 */
export async function customerCoverage(limit = 25): Promise<
  { ok: false; error: string } | { ok: true; coverage: Coverage }
> {
  const cfg = gapConfig()
  if (!cfg) return { ok: false, error: 'EMC credentials or stores not configured' }

  const recent = await prisma.gapSale.findMany({
    orderBy: { occurredAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
    select: { saleHeaderID: true },
  })
  if (recent.length === 0) {
    return { ok: false, error: 'No sales recorded yet — run a cycle first.' }
  }

  const count = { withCustomer: 0, matchable: 0 }
  const f = {
    em: { present: 0, usable: 0 },
    ph: { present: 0, usable: 0 },
    fn: { present: 0, usable: 0 },
    ln: { present: 0, usable: 0 },
    zp: { present: 0, usable: 0 },
  }
  const seen = (raw: string | null | undefined) => Boolean(raw && raw.trim())
  const customerFields = new Map<string, number>()

  const why: Record<string, Map<string, number>> = {
    em: new Map(),
    ph: new Map(),
    fn: new Map(),
    ln: new Map(),
    zp: new Map(),
  }
  const note = (key: string, reason: string) =>
    why[key].set(reason, (why[key].get(reason) ?? 0) + 1)
  const reasonsFor = (key: string) =>
    [...why[key].entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

  for (const row of recent) {
    let detail
    try {
      detail = await getSaleDetail(cfg, row.saleHeaderID)
    } catch {
      continue
    }
    if (!hasRealCustomer(detail)) continue
    count.withCustomer++

    // Field names and whether they are populated. Values are not recorded, and
    // anything that is not a scalar is counted as present without inspection.
    for (const [k, v] of Object.entries((detail.customer ?? {}) as Record<string, unknown>)) {
      const filled =
        v !== null && v !== undefined && v !== '' && !(typeof v === 'string' && !v.trim())
      customerFields.set(k, (customerFields.get(k) ?? 0) + (filled ? 1 : 0))
    }

    const c = detail.customer
    if (seen(c?.email)) f.em.present++
    if (seen(c?.mobile)) f.ph.present++
    if (seen(c?.givenName)) f.fn.present++
    if (seen(c?.familyName)) f.ln.present++
    if (seen(c?.postalCode)) f.zp.present++

    if (normaliseEmail(c?.email)) f.em.usable++
    else if (seen(c?.email)) note('em', 'not a valid email address')

    if (normalisePhoneAu(c?.mobile)) f.ph.usable++
    else if (seen(c?.mobile)) note('ph', phoneRejection(c!.mobile!))

    if (normaliseName(c?.givenName)) f.fn.usable++
    else if (seen(c?.givenName)) note('fn', 'no letters in it')

    if (normaliseName(c?.familyName)) f.ln.usable++
    else if (seen(c?.familyName)) note('ln', 'no letters in it')

    if (normalisePostcode(c?.postalCode)) f.zp.usable++
    else if (seen(c?.postalCode)) note('zp', postcodeRejection(c!.postalCode!))

    if (isMatchable(buildUserData({
      email: c?.email,
      mobile: c?.mobile,
      givenName: c?.givenName,
      familyName: c?.familyName,
      postalCode: c?.postalCode,
    }))) {
      count.matchable++
    }
    // The raw values fall out of scope here and are never written anywhere.
  }

  return {
    ok: true,
    coverage: {
      sampled: recent.length,
      withCustomer: count.withCustomer,
      matchable: count.matchable,
      fields: [
        { key: 'em', label: 'Email', ...f.em, reasons: reasonsFor('em') },
        { key: 'ph', label: 'Phone', ...f.ph, reasons: reasonsFor('ph') },
        { key: 'fn', label: 'First name', ...f.fn, reasons: reasonsFor('fn') },
        { key: 'ln', label: 'Last name', ...f.ln, reasons: reasonsFor('ln') },
        { key: 'zp', label: 'Postcode', ...f.zp, reasons: reasonsFor('zp') },
      ],
      customerFields: [...customerFields.entries()]
        .map(([name, filled]) => ({ name, filled }))
        .sort((a, b) => b.filled - a.filled || a.name.localeCompare(b.name)),
    },
  }
}

// ─── Hourly sales ─────────────────────────────────────────────────────────────

/**
 * What `api/hourlysales` answers, and how.
 *
 * Two possible wins if it works: trade by hour of day, which is a rostering
 * question nothing else here can answer, and a far cheaper backfill — one
 * request a day instead of every sale header. Its parameters are undocumented,
 * so several shapes are tried and the results compared.
 *
 * It will not replace the sales pull. Meta needs one event per sale with that
 * customer attached, and no hourly total can produce that.
 */
export async function probeHourly(): Promise<
  { ok: false; error: string } | { ok: true; store: GapStore; probes: SalesProbe[] }
> {
  const cfg = gapConfig()
  if (!cfg) return { ok: false, error: 'EMC credentials or stores not configured' }

  const store = cfg.stores[0]
  const today = brisbaneToday()
  const yesterday = brisbaneToday(new Date(Date.now() - 86_400_000))

  const probes = await probeEndpoint(cfg, '/api/hourlysales', [
    {
      label: 'StoreID + a single Date',
      params: { StoreID: String(store.id), Date: `${yesterday}T00:00:00` },
    },
    {
      label: 'StoreID + StartDate/EndDate, one day',
      params: {
        StoreID: String(store.id),
        StartDate: `${yesterday}T00:00:00`,
        EndDate: `${yesterday}T23:59:59`,
      },
    },
    {
      label: 'StoreID + a week',
      params: {
        StoreID: String(store.id),
        StartDate: `${brisbaneToday(new Date(Date.now() - 7 * 86_400_000))}T00:00:00`,
        EndDate: `${today}T23:59:59`,
      },
    },
    { label: 'StoreID only', params: { StoreID: String(store.id) } },
    { label: 'No parameters', params: {} },
  ])

  return { ok: true, store, probes }
}

// ─── What shape are the sales? ────────────────────────────────────────────────

export type ShapeField = {
  name: string
  values: { value: string; count: number }[]
}

/**
 * The distribution of the structural fields on a sale header.
 *
 * Asked because the sales report needs to separate in-store from click and
 * collect and home delivery, and it is not yet known whether Gap can tell them
 * apart. The header carries `externalSale`, `externalTransNo`, `imported`,
 * `deptNo`, `zoneID` and `terminalNumber` — if online orders arrive flagged as
 * external, the channel split comes free and MyFoodLink is not needed for it.
 *
 * Counts of values, not sales. Every field here is structural — terminal
 * numbers and department codes — and nothing personal is read.
 */
export async function salesShape(hours = 24): Promise<
  { ok: false; error: string } | { ok: true; sampled: number; store: string; fields: ShapeField[] }
> {
  const cfg = gapConfig()
  if (!cfg) return { ok: false, error: 'EMC credentials or stores not configured' }

  const store = cfg.stores[0]
  const end = new Date()
  const start = new Date(end.getTime() - hours * 60 * 60_000)

  const rows = (await getAllStoreSales(cfg, store, { start, end })) as unknown as Record<
    string,
    unknown
  >[]
  if (rows.length === 0) return { ok: false, error: 'No sales in that window.' }

  // Anything that might encode a channel, a till or a department.
  const keys = [
    'tranType',
    'externalSale',
    'externalTransNo',
    'imported',
    'direction',
    'deptNo',
    'zoneID',
    'terminalNumber',
    'machineName',
    'storeName',
    'requiredExports',
    'processed',
  ]

  const fields: ShapeField[] = []

  for (const key of keys) {
    if (!(key in rows[0])) continue
    const tally = new Map<string, number>()
    for (const r of rows) {
      const v = r[key]
      // A free-text reference is only interesting as present/absent — printing
      // every distinct value would be noise, and could carry an order number.
      const label =
        key === 'externalTransNo'
          ? v === null || v === undefined || v === ''
            ? '(empty)'
            : '(has a value)'
          : String(v ?? '(null)')
      tally.set(label, (tally.get(label) ?? 0) + 1)
    }
    fields.push({
      name: key,
      values: [...tally.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    })
  }

  // How much money sits behind each transaction type.
  //
  // Refunds show as tranType -1, and whether EMC reports them as a negative
  // amount decides how the report counts them. Subtracting an amount that is
  // already negative would double the refund; adding one that is positive
  // would count a refund as a sale. Neither guess is acceptable, so measure.
  const byType = new Map<string, { n: number; total: number; min: number; max: number }>()
  for (const r of rows) {
    const key = String(r.tranType ?? '(null)')
    const amount = Number(r.totalAmount ?? 0)
    const e = byType.get(key) ?? { n: 0, total: 0, min: Infinity, max: -Infinity }
    e.n++
    e.total += amount
    e.min = Math.min(e.min, amount)
    e.max = Math.max(e.max, amount)
    byType.set(key, e)
  }
  fields.push({
    name: 'amount by tranType (dollars)',
    values: [...byType.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .map(([type, e]) => ({
        value: `type ${type}: ${e.n} sales, total ${(e.total / 100).toFixed(2)}, from ${(e.min / 100).toFixed(2)} to ${(e.max / 100).toFixed(2)}`,
        count: e.n,
      })),
  })

  // Online versus counter, the split the report now uses.
  const online = rows.filter((r) => r.externalSale === 1 || r.externalSale === true).length
  fields.push({
    name: 'channel split',
    values: [
      { value: `in store: ${rows.length - online}`, count: rows.length - online },
      { value: `online: ${online}`, count: online },
    ],
  })

  // The identifier prefix differs between sales and may encode the till.
  const prefixes = new Map<string, number>()
  for (const r of rows) {
    const id = String(r.saleIdentifier ?? '')
    if (id.length >= 8) prefixes.set(id.slice(0, 8), (prefixes.get(id.slice(0, 8)) ?? 0) + 1)
  }
  if (prefixes.size > 0) {
    fields.push({
      name: 'saleIdentifier (first 8)',
      values: [...prefixes.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    })
  }

  return { ok: true, sampled: rows.length, store: store.name, fields }
}

// ─── Diagnosis ────────────────────────────────────────────────────────────────

/**
 * Why did a run inspect nothing?
 *
 * A 200 with an empty list is indistinguishable from "no sales happened", so
 * this asks EMC for the same period several ways and reports what each returns.
 * The interesting comparison is the first two: the same sixty minutes, once
 * formatted as Brisbane wall-clock and once as UTC. Whichever returns rows is
 * how EMC reads an unzoned timestamp — which a whole-day window can never
 * reveal, because it returns rows either way.
 */
export async function diagnose(lookbackMinutes = 60): Promise<
  { ok: false; error: string } | { ok: true; store: GapStore; probes: SalesProbe[] }
> {
  const cfg = gapConfig()
  if (!cfg) return { ok: false, error: 'EMC credentials or stores not configured' }

  const store = cfg.stores[0]
  const end = new Date()
  const start = new Date(end.getTime() - lookbackMinutes * 60_000)
  const today = brisbaneToday(end)
  const yesterday = brisbaneToday(new Date(end.getTime() - 24 * 60 * 60_000))

  const probes = await probeSales(cfg, store, [
    {
      label: `Last ${lookbackMinutes} min, as Brisbane wall-clock`,
      params: {
        StartDate: toEmcDateParam(start),
        EndDate: toEmcDateParam(end),
        ExcludeVoids: 'true',
        Take: '10',
      },
    },
    {
      label: `Last ${lookbackMinutes} min, as UTC`,
      params: {
        StartDate: toUtcDateParam(start),
        EndDate: toUtcDateParam(end),
        ExcludeVoids: 'true',
        Take: '10',
      },
    },
    {
      label: `All of today (${today}) — the shape proven in testing`,
      params: {
        StartDate: `${today}T00:00:00`,
        EndDate: `${today}T23:59:59`,
        ExcludeVoids: 'true',
        Take: '10',
      },
    },
    {
      label: `All of yesterday (${yesterday})`,
      params: {
        StartDate: `${yesterday}T00:00:00`,
        EndDate: `${yesterday}T23:59:59`,
        ExcludeVoids: 'true',
        Take: '10',
      },
    },
    {
      label: 'Today, without ExcludeVoids',
      params: { StartDate: `${today}T00:00:00`, EndDate: `${today}T23:59:59`, Take: '10' },
    },
    {
      label: 'No parameters at all',
      params: { Take: '10' },
    },
  ])

  return { ok: true, store, probes }
}

// ─── Status, for the admin console ────────────────────────────────────────────

export type BridgeStatus = {
  configured: { emc: boolean; meta: boolean }
  stores: { id: number; name: string }[]
  settings: BridgeSettings & { testEventCode: string | null; datasetId: string | null; graphVersion: string }
  lastRun: { at: Date; ok: boolean; rows: number; error: string | null; finishedAt: Date | null } | null
  counts: { status: GapSaleStatus; count: number }[]
  today: { orders: number; revenueCents: number }
  recentFailures: {
    saleIdentifier: string
    occurredAt: Date
    attemptCount: number
    lastError: string | null
  }[]
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  const settings = bridgeSettings()
  const cfg = gapConfig()
  const capi = capiConfig()
  const todayDay = calendarDay(brisbaneToday())!

  const [lastRun, grouped, todayAgg, recentFailures] = await Promise.all([
    prisma.ingestRun.findFirst({
      where: { source: RUN_SOURCE },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, ok: true, rows: true, error: true, finishedAt: true },
    }),
    prisma.gapSale.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.gapSale.aggregate({
      where: { day: todayDay, tranType: 0 },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    prisma.gapSale.findMany({
      where: { status: GapSaleStatus.FAILED },
      orderBy: { inspectedAt: 'desc' },
      take: 5,
      select: { saleIdentifier: true, occurredAt: true, attemptCount: true, lastError: true },
    }),
  ])

  return {
    configured: { emc: Boolean(cfg), meta: Boolean(capi) },
    stores: cfg?.stores ?? [],
    settings: {
      ...settings,
      testEventCode: capi?.testEventCode ?? null,
      datasetId: capi?.datasetId ?? null,
      graphVersion: capi?.version ?? 'v26.0',
    },
    lastRun: lastRun ? { at: lastRun.startedAt, ...lastRun } : null,
    counts: grouped.map((g) => ({ status: g.status, count: g._count._all })),
    today: { orders: todayAgg._count._all, revenueCents: todayAgg._sum.totalCents ?? 0 },
    recentFailures,
  }
}
