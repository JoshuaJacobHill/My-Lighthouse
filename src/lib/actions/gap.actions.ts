'use server'

import { revalidatePath } from 'next/cache'
import { hasCapability } from '@/lib/permissions'
import {
  backfillDays,
  customerCoverage,
  diagnose,
  probeHourly,
  salesShape,
  type ShapeField,
  processOneSale,
  runOnce,
  type BackfillResult,
  type Coverage,
  type RunSummary,
  type SaleOutcome,
} from '@/lib/gap-bridge'
import type { GapStore, SalesProbe } from '@/lib/integrations/gap'
import { resetGapToken } from '@/lib/integrations/gap'

/**
 * Admin actions for the POS bridge.
 *
 * Every one of them is gated on `business.reports` — the same switch that opens
 * the sales report itself. These reach into the till system and, once
 * identifiers are switched on, send data to Meta; they are not for every admin.
 */

async function guard(): Promise<boolean> {
  return hasCapability('business.reports')
}

export async function runBridgeNowAction(
  lookbackMinutes?: number,
): Promise<{ success: boolean; summary?: RunSummary; error?: string }> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }

  const clamped =
    typeof lookbackMinutes === 'number' && Number.isFinite(lookbackMinutes) && lookbackMinutes > 0
      ? Math.min(Math.round(lookbackMinutes), 60 * 24 * 14)
      : undefined

  const summary = await runOnce(clamped ? { lookbackMinutes: clamped } : undefined)
  revalidatePath('/dashboard/business/bridge')
  return { success: summary.ok, summary, error: summary.error }
}

export async function testSaleAction(
  saleHeaderID: number,
): Promise<{ success: boolean; outcome?: SaleOutcome; dryRun?: boolean; error?: string }> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  if (!Number.isFinite(saleHeaderID) || saleHeaderID <= 0) {
    return { success: false, error: 'Enter a sale header ID.' }
  }

  const result = await processOneSale(Math.round(saleHeaderID))
  revalidatePath('/dashboard/business/bridge')
  if (!result.ok) return { success: false, error: result.error }
  return { success: true, outcome: result.outcome, dryRun: result.dryRun }
}

/**
 * Throw away the cached EMC token.
 *
 * Rarely needed — a stale token refreshes itself on the next 401 — but useful
 * straight after the integration account's password changes, when the cached
 * token is valid and simply belongs to the old credentials.
 */
export async function resetGapTokenAction(): Promise<{ success: boolean; error?: string }> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  resetGapToken()
  return { success: true }
}

/**
 * Ask EMC for the same sales several ways and report what came back.
 *
 * For the case a run "succeeds" having inspected nothing. Reads sale headers
 * only — ids, times, counts and totals, no customer detail.
 */
export async function diagnoseGapAction(
  lookbackMinutes?: number,
): Promise<{ success: boolean; store?: GapStore; probes?: SalesProbe[]; error?: string }> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  const res = await diagnose(
    Number.isFinite(lookbackMinutes) && (lookbackMinutes ?? 0) > 0 ? lookbackMinutes : 60,
  )
  if (!res.ok) return { success: false, error: res.error }
  return { success: true, store: res.store, probes: res.probes }
}

/**
 * How much of the recent customer data Meta could actually match on.
 *
 * Counts only — which fields are filled in and which survive normalisation.
 * The values themselves are read to test them and discarded.
 */
export async function coverageAction(
  limit?: number,
): Promise<{ success: boolean; coverage?: Coverage; error?: string }> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  const res = await customerCoverage(limit ?? 25)
  if (!res.ok) return { success: false, error: res.error }
  return { success: true, coverage: res.coverage }
}

/**
 * How Gap labels its own sales — tills, departments, external flags.
 *
 * For working out whether online orders can be told apart from counter trade
 * without a second integration. Structural fields only.
 */
export async function salesShapeAction(
  hours?: number,
): Promise<{ success: boolean; sampled?: number; store?: string; fields?: ShapeField[]; error?: string }> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  const res = await salesShape(hours ?? 24)
  if (!res.ok) return { success: false, error: res.error }
  return { success: true, sampled: res.sampled, store: res.store, fields: res.fields }
}

/**
 * One chunk of a historical backfill. The caller loops on `nextDay`.
 *
 * Chunked because a serverless function has about a minute, and a year of
 * trade is more than that however cheap each day is.
 */
export async function backfillAction(
  fromDay: string,
  days = 14,
): Promise<{ success: boolean; result?: BackfillResult; error?: string }> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  const res = await backfillDays({ fromDay, days: Math.min(Math.max(days, 1), 60) })
  if (!res.ok) return { success: false, error: res.error }
  const { ok: _ok, ...result } = res
  return { success: true, result }
}

/** What `api/hourlysales` returns, and for which parameters. */
export async function probeHourlyAction(): Promise<{
  success: boolean
  store?: GapStore
  probes?: SalesProbe[]
  error?: string
}> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  const res = await probeHourly()
  if (!res.ok) return { success: false, error: res.error }
  return { success: true, store: res.store, probes: res.probes }
}
