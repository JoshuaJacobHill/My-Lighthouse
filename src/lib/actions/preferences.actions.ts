'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type Result = { success: boolean; error?: string }

/**
 * Notification preferences.
 *
 * Only the optional kinds are settable. Tasks and shift requests deliberately
 * have no switch — they are work someone is waiting on, and silencing them
 * means an assignment disappears with nobody realising.
 */
export async function setNotifyPreferenceAction(
  key: 'notifyEmail' | 'notifyComments' | 'notifyMentions' | 'notifyStories',
  value: boolean,
): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  const allowed = ['notifyEmail', 'notifyComments', 'notifyMentions', 'notifyStories'] as const
  if (!allowed.includes(key)) return { success: false, error: 'Unknown setting.' }

  await prisma.user.update({ where: { id: session.userId }, data: { [key]: value } })
  revalidatePath('/dashboard/account/notifications')
  return { success: true }
}
