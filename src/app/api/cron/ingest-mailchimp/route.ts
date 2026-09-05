import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ingestMailchimp } from '@/lib/integrations/mailchimp'
import { hasCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ─── GET /api/cron/ingest-mailchimp ──────────────────────────────────────────
//
// Campaign performance into SocialPost, so an email can be ranked against a
// post. Nightly. Fails CLOSED: cron secret, or someone who can see the report.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  if (!hasValidSecret) {
    const session = await getSession()
    if (!session || !(await hasCapability('business.reports'))) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
  }

  const days = Number(new URL(request.url).searchParams.get('days'))
  const result = await ingestMailchimp(
    Number.isFinite(days) && days > 0 ? { days: Math.min(days, 800) } : {},
  )
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
