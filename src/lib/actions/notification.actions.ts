'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertCapability, hasCapability } from '@/lib/permissions'
import {
  notify,
  audienceCapability,
  describeAudience,
  resolveAudience,
  type Audience,
} from '@/lib/notifications'
import type { NotificationCategory } from '@prisma/client'

type Result = { success: boolean; error?: string }

/**
 * Opening the panel clears the badge — it does not clear the list. Read is
 * "you have seen that this exists", which is not the same as "you have dealt
 * with it": a task you glanced at on the bus is still a task.
 */
export async function markAllReadAction(): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  await prisma.notificationRecipient.updateMany({
    where: { userId: session.userId, readAt: null, dismissedAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath('/dashboard/notifications')
  return { success: true }
}

/**
 * "Clear all" — hides them from the feed. The underlying work is untouched:
 * a cleared task notification does not clear the task.
 */
export async function clearAllAction(): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  const now = new Date()
  await prisma.notificationRecipient.updateMany({
    where: { userId: session.userId, dismissedAt: null },
    data: { dismissedAt: now, readAt: now },
  })
  revalidatePath('/dashboard/notifications')
  return { success: true }
}

/** Clear a single one. */
export async function clearOneAction(recipientId: string): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  const now = new Date()
  await prisma.notificationRecipient.updateMany({
    where: { id: recipientId, userId: session.userId },
    data: { dismissedAt: now, readAt: now },
  })
  revalidatePath('/dashboard/notifications')
  return { success: true }
}

/**
 * Send one by hand from the admin panel.
 *
 * Two permission checks, deliberately: `system.settings` to send at all, and
 * then whatever the chosen audience itself requires — so a Church Manager
 * cannot address the volunteer list, and vice versa.
 */
export async function sendNotificationAction(input: {
  audience: Audience
  category: NotificationCategory
  title: string
  body: string
  href: string
  actionLabel?: string
}): Promise<Result & { sent?: number }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  try {
    await assertCapability('system.settings')
  } catch {
    return { success: false, error: 'You do not have permission to send notifications.' }
  }

  const needed = audienceCapability(input.audience)
  if (needed && !(await hasCapability(needed))) {
    return {
      success: false,
      error: `You do not have permission to send to ${describeAudience(input.audience).toLowerCase()}.`,
    }
  }

  const title = input.title.trim()
  const body = input.body.trim()
  const href = input.href.trim()
  if (!title || !body) return { success: false, error: 'Give it a title and a line of text.' }
  if (!href.startsWith('/')) {
    return { success: false, error: 'The link must be a path within the portal, starting with /.' }
  }

  const sent = await notify({
    audience: input.audience,
    category: input.category,
    title,
    body,
    href,
    actionLabel: input.actionLabel?.trim() || undefined,
    createdById: session.userId,
  })

  revalidatePath('/admin/notifications')
  return { success: true, sent }
}

/** How many people an audience currently covers, for the admin preview. */
export async function countAudienceAction(
  audience: Audience,
): Promise<{ count: number; label: string }> {
  const session = await getSession()
  if (!session) return { count: 0, label: '' }
  try {
    await assertCapability('system.settings')
  } catch {
    return { count: 0, label: '' }
  }
  const ids = await resolveAudience(audience)
  return { count: ids.length, label: describeAudience(audience) }
}
