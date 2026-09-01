import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isAdminRole } from '@/lib/permissions-core'
import { readStepsFromScreenshot } from '@/lib/step-screenshot'
import { brisbaneToday } from '@/lib/fitness-days'
import { encodeDraft } from '@/lib/step-draft'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CONFIRM = '/dashboard/fitness/share'

/**
 * Where Android's share sheet delivers a screenshot.
 *
 * Registered in the web app manifest as a share target, so once the portal is
 * on someone's home screen it appears alongside Messages and Gmail when they
 * share a screenshot. That turns logging steps into: screenshot, share, confirm.
 *
 * The image is read and discarded here. Only the number and date travel on,
 * signed, to the confirmation page.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isStaff: true, isTrainee: true, role: true },
  })
  if (!me || !(me.isStaff || me.isTrainee || isAdminRole(me.role))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${CONFIRM}?error=${encodeURIComponent(reason)}`, request.url))

  let file: FormDataEntryValue | null = null
  try {
    const form = await request.formData()
    file = form.get('screenshot')
  } catch {
    return fail('That did not come through. Please try again.')
  }
  if (!(file instanceof File) || file.size === 0) {
    return fail('No image came through. Please share a screenshot.')
  }

  const result = await readStepsFromScreenshot(new Uint8Array(await file.arrayBuffer()))
  if (!result.ok) return fail(result.error)

  const { reading } = result
  if (!reading.looksLikeStepScreen) {
    return fail('That does not look like a step screen. Try the one showing your daily total.')
  }
  if (reading.steps == null || reading.steps < 0 || reading.steps > 200_000) {
    return fail(reading.note || 'We could not find a daily total in that one.')
  }

  const explicit = reading.date && /^\d{4}-\d{2}-\d{2}$/.test(reading.date) ? reading.date : null
  const query = encodeDraft(session.userId, {
    steps: reading.steps,
    day: explicit ?? brisbaneToday(),
    assumed: !explicit,
  })

  return NextResponse.redirect(new URL(`${CONFIRM}?${query}`, request.url))
}
