import { NextRequest } from 'next/server'
import { recordSteps } from '../route'

export const dynamic = 'force-dynamic'

/**
 * POST /api/fitness/steps/<your token>
 *
 * The same thing as posting to /api/fitness/steps with an Authorization header,
 * with the token in the path instead. It exists purely because setting a custom
 * header in the Shortcuts app is the step people get stuck on — a personal link
 * they paste into one field is a much shorter road.
 *
 *   { "steps": 8421 }
 *   { "steps": 8421, "day": "2026-09-03" }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return recordSteps(request, decodeURIComponent(token))
}
