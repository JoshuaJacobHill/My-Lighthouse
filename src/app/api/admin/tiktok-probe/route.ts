import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { probeTikTok } from '@/lib/integrations/tiktok'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── GET /api/admin/tiktok-probe ─────────────────────────────────────────────
//
// What TikTok actually returns for our videos, field by field.
//
// The field names in the client came from TikTok's documentation rather than
// from the account. Twice in one afternoon that has been the difference
// between a working feed and a silent zero, so this is the first thing to run
// once credentials are in — before believing any figure it produces.
export async function GET() {
  const session = await getSession()
  if (!session || !(await hasCapability('business.reports'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const result = await probeTikTok()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
