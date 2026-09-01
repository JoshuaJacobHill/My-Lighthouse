'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isAdminRole } from '@/lib/permissions-core'
import { brisbaneToday, calendarDay } from '@/lib/fitness-days'
import { readStepsFromScreenshot } from '@/lib/step-screenshot'
import { generateFitnessCode } from '@/lib/fitness-code'

interface Result {
  success: boolean
  error?: string
}

/** Staff (and trainees) only — this is an internal wellbeing feature. */
async function requireStaff(): Promise<{ userId: string } | null> {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isStaff: true, isTrainee: true, role: true },
  })
  const allowed =
    user?.isStaff || user?.isTrainee || isAdminRole(user?.role)
  return allowed ? { userId: session.userId } : null
}

const schema = z.object({
  challengeId: z.string().min(1),
  day: z.string().min(1), // yyyy-mm-dd, Brisbane wall-clock
  amount: z.coerce.number().int().min(0, 'Steps can’t be negative').max(200_000, 'That looks too high — please check'),
})
export type LogFitnessInput = z.input<typeof schema>

/**
 * Record (or correct) one day's steps. Upserted on (challenge, user, day) so
 * re-entering a day fixes the number instead of double-counting it.
 */
export async function logFitnessAction(input: LogFitnessInput): Promise<Result> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'This is a staff-only challenge.' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check the details.' }
  }
  const { challengeId, day, amount } = parsed.data

  const challenge = await prisma.fitnessChallenge.findFirst({
    where: { id: challengeId, isActive: true },
    select: { startsAt: true, endsAt: true },
  })
  if (!challenge) return { success: false, error: 'That challenge isn’t running.' }

  const dayDate = calendarDay(day)
  if (!dayDate) return { success: false, error: 'Please choose a valid date.' }
  if (dayDate < challenge.startsAt || dayDate > challenge.endsAt) {
    return { success: false, error: 'That date is outside the challenge period.' }
  }

  await prisma.fitnessEntry.upsert({
    where: { challengeId_userId_day: { challengeId, userId: me.userId, day: dayDate } },
    update: { amount },
    create: { challengeId, userId: me.userId, day: dayDate, amount },
  })

  revalidatePath('/staff/fitness')
  return { success: true }
}

// ─── Connecting a phone ───────────────────────────────────────────────────────

/**
 * Create (or replace) this person's push token. Opt-in: nothing exists until
 * they ask for it here, and generating a new one immediately invalidates the
 * old, so a lost phone is dealt with by pressing the button again.
 */
export async function connectFitnessAction(): Promise<{ success: boolean; token?: string; error?: string }> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'This is a staff-only challenge.' }

  const token = generateFitnessCode()
  try {
    await prisma.fitnessLink.upsert({
      where: { userId: me.userId },
      update: { token, revokedAt: null, createdAt: new Date(), lastUsedAt: null, lastAmount: null },
      create: { userId: me.userId, token },
    })
  } catch (err) {
    console.error('connectFitnessAction failed', err)
    return { success: false, error: 'Could not set that up. Please try again.' }
  }
  revalidatePath('/dashboard/fitness/connect')
  revalidatePath('/dashboard/fitness')
  return { success: true, token }
}

/** Turn the link off. Steps already recorded stay — only the pushing stops. */
export async function disconnectFitnessAction(): Promise<Result> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'This is a staff-only challenge.' }
  try {
    await prisma.fitnessLink.updateMany({
      where: { userId: me.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  } catch (err) {
    console.error('disconnectFitnessAction failed', err)
    return { success: false, error: 'Could not disconnect. Please try again.' }
  }
  revalidatePath('/dashboard/fitness/connect')
  revalidatePath('/dashboard/fitness')
  return { success: true }
}

// ─── Reading a screenshot ─────────────────────────────────────────────────────

export interface ScreenshotResult {
  success: boolean
  error?: string
  /** True when the feature simply isn't configured, so the UI can hide itself. */
  unavailable?: boolean
  steps?: number
  day?: string
  /** Did the screenshot actually show a date, or are we assuming today? */
  dateAssumed?: boolean
  note?: string
}

/**
 * Read a step count off an uploaded screenshot and hand it back for the person
 * to confirm. Nothing is saved here and the image is never stored — the bytes
 * live in this function's scope and go out of it with the response.
 *
 * Confirmation is deliberate: the number goes into the form, the person checks
 * it against their own screen, and they press save. We never write a figure
 * straight from an image into the leaderboard.
 */
export async function readStepsScreenshotAction(formData: FormData): Promise<ScreenshotResult> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'This is a staff-only challenge.' }

  const file = formData.get('screenshot')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Please choose a screenshot.' }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = await readStepsFromScreenshot(bytes)
  if (!result.ok) {
    return { success: false, error: result.error, unavailable: result.unavailable }
  }

  const { reading } = result
  if (!reading.looksLikeStepScreen) {
    return { success: false, error: 'That doesn’t look like a step screen. Try the one showing your daily total.' }
  }
  if (reading.steps == null || reading.steps < 0 || reading.steps > 200_000) {
    return {
      success: false,
      error: reading.note || 'We couldn’t find a clear daily total in that. Try typing it in instead.',
    }
  }

  // A date printed in the image is used as-is; anything else falls back to today
  // and is flagged so the person can correct it before saving.
  const explicit = reading.date && /^\d{4}-\d{2}-\d{2}$/.test(reading.date) ? reading.date : null
  return {
    success: true,
    steps: reading.steps,
    day: explicit ?? brisbaneToday(),
    dateAssumed: !explicit,
    note: reading.note,
  }
}

// ─── The cheer wall ───────────────────────────────────────────────────────────

const cheerSchema = z.object({
  challengeId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(2, 'Say a little more than that.')
    .max(280, 'Keep it under 280 characters.'),
})

/**
 * Leave a note for the team today.
 *
 * Capped at a handful a day per person. Not to police anyone, just so one
 * enthusiastic morning does not bury everyone else's.
 */
export async function postCheerAction(input: {
  challengeId: string
  body: string
}): Promise<Result & { id?: string }> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'This is a staff-only challenge.' }

  const parsed = cheerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check that.' }
  }

  const day = calendarDay(brisbaneToday())!
  const today = await prisma.challengeCheer.count({
    where: { userId: me.userId, challengeId: parsed.data.challengeId, day },
  })
  if (today >= 5) {
    return { success: false, error: 'That is five for today. Save some for tomorrow.' }
  }

  try {
    const row = await prisma.challengeCheer.create({
      data: {
        challengeId: parsed.data.challengeId,
        userId: me.userId,
        body: parsed.data.body,
        day,
      },
      select: { id: true },
    })
    revalidatePath('/dashboard/fitness')
    return { success: true, id: row.id }
  } catch (err) {
    console.error('postCheerAction failed', err)
    return { success: false, error: 'Could not post that. Please try again.' }
  }
}

/** Remove a note. Your own, or anyone's if you are an admin. */
export async function deleteCheerAction(id: string): Promise<Result> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'This is a staff-only challenge.' }

  const user = await prisma.user.findUnique({ where: { id: me.userId }, select: { role: true } })
  const canRemoveAnyone = isAdminRole(user?.role)

  const deleted = await prisma.challengeCheer.deleteMany({
    where: { id, ...(canRemoveAnyone ? {} : { userId: me.userId }) },
  })
  if (deleted.count === 0) return { success: false, error: 'That note is not yours to remove.' }

  revalidatePath('/dashboard/fitness')
  return { success: true }
}
