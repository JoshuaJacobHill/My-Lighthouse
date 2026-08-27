'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

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
    user?.isStaff || user?.isTrainee || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
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

  // Treat the entered date as a Brisbane calendar day.
  const dayDate = new Date(`${day}T00:00:00+10:00`)
  if (Number.isNaN(dayDate.getTime())) return { success: false, error: 'Please choose a valid date.' }
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
