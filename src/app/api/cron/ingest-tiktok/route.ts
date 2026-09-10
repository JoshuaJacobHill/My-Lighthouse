import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { ingestTikTok } from '@/lib/integrations/tiktok'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ─── GET /api/cron/ingest-tiktok ─────────────────────────────────────────────
//
// Pulls our own TikTok videos and their figures into SocialPost, where the
// report already reads them.
//
// ?limit=200 widens the window for a first backfill. Admin only — a cron token
// gets the normal window, so a leaked token cannot be used to hammer TikTok.
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

  const requested = Number(request.nextUrl.searchParams.get('limit'))
  const limit =
    byHand && Number.isFinite(requested) && requested > 0 ? Math.min(requested, 300) : undefined

  const started = Date.now()
  const result = await ingestTikTok(limit ? { limit } : {})

  return NextResponse.json(
    { ...result, limit: limit ?? 'default', tookMs: Date.now() - started },
    { status: result.ok ? 200 : 500 },
  )
}
