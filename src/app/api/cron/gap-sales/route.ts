import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { runOnce } from '@/lib/gap-bridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ─── GET /api/cron/gap-sales ─────────────────────────────────────────────────
//
// One polling cycle of the Gap Solutions → Meta bridge. Runs every ten minutes
// with an hour's overlap, so a missed run, a slow EMC or a redeploy cannot lose
// a sale — deduplication on saleIdentifier is what makes the overlap free.
//
// ?lookback=1440 widens the window for a backfill. Only for someone who can see
// the report: a leaked cron token gets the normal window and nothing else, so it
// cannot be used to pull a month of transactions out of the POS.
//
// Fails CLOSED: a valid CRON_SECRET, or a person with business.reports.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  let byHand = false
  if (!hasValidSecret) {
    const session = await getSession()
    if (!session || !(await hasCapability('business.reports'))) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    byHand = true
  }

  const requested = Number(request.nextUrl.searchParams.get('lookback'))
  const lookbackMinutes =
    byHand && Number.isFinite(requested) && requested > 0 ? Math.min(requested, 60 * 24 * 14) : undefined

  const summary = await runOnce(lookbackMinutes ? { lookbackMinutes } : undefined)

  return NextResponse.json(summary, { status: summary.ok || summary.skippedRun ? 200 : 500 })
}
