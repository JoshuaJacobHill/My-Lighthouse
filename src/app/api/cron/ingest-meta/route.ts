import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ingestMeta } from '@/lib/integrations/meta'
import { hasCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ─── GET /api/cron/ingest-meta ───────────────────────────────────────────────
//
// Pulls Meta ads, Facebook posts and Instagram media into SocialPost and
// AdDayStat. Runs nightly; the ad window is deliberately short because figures
// settle in a few days and history accumulates.
//
// ?days=90 widens the ad window for a first backfill. Admin only — a cron token
// gets the normal window, so a leaked token cannot be used to hammer the Graph
// API with three-month pulls.
//
// Fails CLOSED: a valid CRON_SECRET, or someone who can see the report.
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

  const requested = Number(new URL(request.url).searchParams.get('days'))
  const days = byHand && Number.isFinite(requested) && requested > 0
    ? Math.min(requested, 400)
    : undefined

  const started = Date.now()
  const result = await ingestMeta(days ? { days } : {})

  return NextResponse.json(
    {
      ...result,
      days: days ?? 'default',
      tookMs: Date.now() - started,
    },
    { status: result.ok ? 200 : 500 },
  )
}
