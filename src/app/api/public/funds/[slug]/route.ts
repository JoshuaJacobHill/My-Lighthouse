import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ─── GET /api/public/funds/[slug] ─────────────────────────────────────────────
//
// Public, read-only progress for a fund (raised vs goal). Returns data only when
// the fund has showPublicProgress enabled, so totals never leak before staff opt
// in. Intended for a lightweight JS widget on lighthousecare.org.au; CORS is
// scoped to the Lighthouse Care origins.

const ALLOWED_ORIGINS = [
  'https://lighthousecare.org.au',
  'https://www.lighthousecare.org.au',
]

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Cache-Control': 'no-store',
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const fund = await prisma.fund.findUnique({
    where: { slug },
    select: { id: true, name: true, goalAmount: true, showPublicProgress: true },
  })

  if (!fund || !fund.showPublicProgress) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders(req) })
  }

  const agg = await prisma.donation.aggregate({
    where: { fundId: fund.id },
    _sum: { amount: true },
  })
  const raised = Number(agg._sum.amount ?? 0)
  const goal = fund.goalAmount ? Number(fund.goalAmount) : null
  const pct = goal && goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null

  return NextResponse.json(
    { name: fund.name, slug, raised, goal, pct, currency: 'AUD' },
    { headers: corsHeaders(req) }
  )
}
