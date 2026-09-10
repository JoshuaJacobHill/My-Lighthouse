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

  const q = new URL(request.url).searchParams
  const requested = Number(q.get('days'))
  const days = byHand && Number.isFinite(requested) && requested > 0
    ? Math.min(requested, 400)
    : undefined

  // How far back to re-read organic post metrics. The nightly run keeps its
  // small default: a year of post insights re-fetched every night would be
  // thousands of requests to rediscover numbers that have not changed.
  const requestedPosts = Number(q.get('posts'))
  const posts = byHand && Number.isFinite(requestedPosts) && requestedPosts > 0
    ? Math.min(requestedPosts, 600)
    : undefined

  const started = Date.now()
  const result = await ingestMeta({ ...(days ? { days } : {}), ...(posts ? { posts } : {}) })

  return NextResponse.json(
    {
      ...result,
      days: days ?? 'default',
      posts: posts ?? 'default',
      tookMs: Date.now() - started,
    },
    { status: result.ok ? 200 : 500 },
  )
}
