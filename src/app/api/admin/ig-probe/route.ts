import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { probeInstagramMetrics } from '@/lib/integrations/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── GET /api/admin/ig-probe ─────────────────────────────────────────────────
//
// Every insight Instagram will give for one post, metric by metric.
//
// Built because a post reading 7,999 views here was reported as 80,000 in the
// app, and there is no way to settle that by reading our own code: either
// Instagram offers a metric we are not asking for, or the two numbers are
// measuring different things — the organic post and the ad built from it.
//
// ?media=<id> for one post, or nothing for the most recent few.
// Read-only, and gated on business.reports like the report itself.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('business.reports'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const mediaId = request.nextUrl.searchParams.get('media')
  const result = await probeInstagramMetrics(mediaId ?? undefined)

  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
