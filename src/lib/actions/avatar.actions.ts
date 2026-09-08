'use server'

import { put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type Result = { success: boolean; error?: string; url?: string }

/** Deliberately small. A profile photo renders at 96px; nobody needs 8MB of it. */
const MAX_BYTES = 4 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * A profile photo, for the signed-in person only.
 *
 * Separate from uploadImageAction, which is admin-only because it handles
 * story and sponsor artwork. Relaxing that guard to cover avatars would have
 * opened story uploads to everyone, so this is its own narrow door: own
 * account only, images only, 4MB.
 */
export async function uploadAvatarAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Choose a photo first.' }
  }
  if (!TYPES.includes(file.type)) {
    return { success: false, error: 'That needs to be a JPEG, PNG, WebP or HEIC image.' }
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: 'That photo is over 4MB — please pick a smaller one.' }
  }

  try {
    // Keyed by user so a re-upload replaces rather than accumulates, and
    // randomSuffix keeps the URL unguessable from someone's id alone.
    const blob = await put(`avatars/${session.userId}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })
    await prisma.user.update({
      where: { id: session.userId },
      data: { imageUrl: blob.url },
    })
    revalidatePath('/dashboard/account')
    revalidatePath('/dashboard/account/details')
    return { success: true, url: blob.url }
  } catch (err) {
    console.error('uploadAvatarAction failed', err)
    return { success: false, error: 'Could not upload that. Please try again.' }
  }
}

/** Back to initials. */
export async function removeAvatarAction(): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }
  await prisma.user.update({ where: { id: session.userId }, data: { imageUrl: null } })
  revalidatePath('/dashboard/account')
  revalidatePath('/dashboard/account/details')
  return { success: true }
}
