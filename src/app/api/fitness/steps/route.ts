import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { brisbaneToday, calendarDay } from '@/lib/fitness-days'
import { normaliseFitnessCode } from '@/lib/fitness-code'
import { rateLimit } from '@/lib/rate-limit'
import { getCurrentChallenge } from '@/lib/fitness-data'

export const dynamic = 'force-dynamic'

/**
 * POST /api/fitness/steps — where a phone pushes its own step count.
 *
 * Called by the iOS Shortcut a staff member sets up themselves (see
 * /dashboard/fitness/connect). Apple Health can't be read from a web page, so
 * this is the inverse: the phone reads Health natively and posts the number.
 *
 *   Authorization: Bearer <their token>
 *   { "steps": 8421 }                  ← today, Brisbane
 *   { "steps": 8421, "day": "2026-09-03" }  ← a specific day, for backfills
 *
 * Deliberately write-only: it never returns anyone's data, and a token can only
 * ever write its own owner's steps.
 */

const MAX_STEPS = 200_000

function bearer(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

export async function POST(request: NextRequest) {
  const token = bearer(request)
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 401 })
  }
  return recordSteps(request, token)
}

/**
 * Shared by both ways in: an Authorization header, and a personal URL with the
 * token in the path. The second exists because setting a custom header in the
 * Shortcuts app is the step most people get stuck on, and a link they can paste
 * is far easier to follow.
 *
 * The trade-off is that a token in a URL ends up in server logs. It's accepted
 * here because this token is write-only — the worst anyone can do with it is
 * add step counts to its owner's tally — and it can be replaced from the
 * portal in one tap.
 */
export async function recordSteps(request: NextRequest, rawToken: string) {
  // The code is short enough to be typed, so the endpoint has to be the thing
  // that makes guessing pointless. Generous for a phone posting a few times a
  // day; nowhere near enough to work through 380 billion possibilities.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`steps:ip:${ip}`, 60, 60_000).ok) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  }

  const token = normaliseFitnessCode(rawToken)
  const link = await prisma.fitnessLink.findUnique({
    where: { token },
    select: { id: true, userId: true, revokedAt: true },
  })
  // Same response either way — a wrong token and a revoked one shouldn't be
  // distinguishable from outside.
  if (!link || link.revokedAt) {
    return NextResponse.json({ ok: false, error: 'Not connected' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body' }, { status: 400 })
  }

  const payload = body as { steps?: unknown; day?: unknown }
  // Shortcuts sends numbers as text often enough that coercing is kinder than
  // rejecting; anything that isn't a whole number still fails.
  const steps = Math.round(Number(payload.steps))
  if (!Number.isFinite(steps) || steps < 0 || steps > MAX_STEPS) {
    return NextResponse.json(
      { ok: false, error: `steps must be a whole number between 0 and ${MAX_STEPS}` },
      { status: 400 }
    )
  }

  const now = new Date()
  const day = typeof payload.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.day)
    ? payload.day
    : brisbaneToday(now)

  // Same selection as the pages, so a phone posting during a test run lands in
  // the test rather than in a challenge that hasn't started.
  const challenge = await getCurrentChallenge()
  if (!challenge) {
    return NextResponse.json({ ok: false, error: 'No challenge is running' }, { status: 409 })
  }

  const dayDate = calendarDay(day)
  if (!dayDate) {
    return NextResponse.json({ ok: false, error: 'day must be a real date, as yyyy-mm-dd' }, { status: 400 })
  }
  if (dayDate < challenge.startsAt || dayDate > challenge.endsAt) {
    // Not an error the phone can act on — the automation will keep firing after
    // the challenge ends, and it shouldn't look broken when it does.
    return NextResponse.json({ ok: true, recorded: false, reason: 'Outside the challenge dates' })
  }

  try {
    await prisma.fitnessEntry.upsert({
      where: { challengeId_userId_day: { challengeId: challenge.id, userId: link.userId, day: dayDate } },
      // The phone always sends the day's running total, so overwrite rather
      // than add — otherwise a retry or a second device doubles the count.
      update: { amount: steps },
      create: { challengeId: challenge.id, userId: link.userId, day: dayDate, amount: steps },
    })
    await prisma.fitnessLink.update({
      where: { id: link.id },
      data: { lastUsedAt: now, lastAmount: steps },
    })
  } catch (err) {
    console.error('[fitness/steps] could not record', err)
    return NextResponse.json({ ok: false, error: 'Could not record that' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recorded: true, day, steps })
}
