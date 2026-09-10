'use server'

import { revalidatePath } from 'next/cache'
import { hasCapability } from '@/lib/permissions'
import { diagnose, processOneSale, runOnce, type RunSummary, type SaleOutcome } from '@/lib/gap-bridge'
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
