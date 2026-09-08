'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { notify } from '@/lib/notifications'

type Result = { success: boolean; error?: string }


/** Send the notice to one person. Deliberate, and recorded. */
export async function sendFairPlayNoticeAction(userId: string): Promise<Result> {
  const session = await getSession()
  if (session?.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Only a super admin can send this.' }
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  })
  if (!target) return { success: false, error: 'Person not found.' }

  await prisma.user.update({
    where: { id: userId },
    // Clearing the acknowledgement so a fresh send shows again for someone who
    // read a previous one.
    data: { fairPlayNoticeAt: new Date(), fairPlayNoticeAckAt: null },
  })

  await notify({
    audience: { kind: 'users', ids: [userId] },
    category: 'CHALLENGE',
    title: 'September Steps',
    body: 'There’s a note for you about how steps are counted',
    href: '/dashboard/fitness',
    actionLabel: 'Read it',
    createdById: session.userId,
  })

  revalidatePath('/dashboard/fitness')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

/** Withdraw it — sent to the wrong person, or the conversation has happened. */
export async function clearFairPlayNoticeAction(userId: string): Promise<Result> {
  const session = await getSession()
  if (session?.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Only a super admin can do this.' }
  }
  await prisma.user.update({
    where: { id: userId },
    data: { fairPlayNoticeAt: null, fairPlayNoticeAckAt: null },
  })
  revalidatePath('/dashboard/fitness')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

/** "I've read this" — the person's own acknowledgement. */
export async function acknowledgeFairPlayAction(): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  await prisma.user.update({
    where: { id: session.userId },
    data: { fairPlayNoticeAckAt: new Date() },
  })
  revalidatePath('/dashboard/fitness')
  return { success: true }
}
