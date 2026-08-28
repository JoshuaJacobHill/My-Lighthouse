'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { storySchema, type StoryInput } from '@/lib/validations'
import { can, isAdminRole, type PermissionUser } from '@/lib/permissions-core'

interface ActionResult {
  success: boolean
  error?: string
  storyId?: string
}

async function requireAdminSession(): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (!isAdminRole(session.role)) {
    throw new Error('Insufficient permissions')
  }
}

/**
 * Stories are the one thing both sides of the house write, so a story's
 * audience decides who may touch it: `churchOnly` stories belong to the church
 * manager, everything else to the Care side. Enforced here rather than only in
 * the form, because the audience arrives from the client and a church manager
 * could otherwise untick the box and publish to every volunteer.
 */
async function requireStoryAudience(churchOnly: boolean): Promise<void> {
  const me = await currentPermissionUser()
  const needed = churchOnly ? 'church.stories' : 'care.stories'
  if (!can(me, needed)) {
    throw new Error(
      churchOnly
        ? 'You do not have permission to publish church stories.'
        : 'You do not have permission to publish Care stories.'
    )
  }
}

async function currentPermissionUser(): Promise<PermissionUser> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, canViewDonations: true },
  })
  if (!user) throw new Error('Not authenticated')
  return user
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || 'story'
  let candidate = root
  let n = 1
  for (;;) {
    const existing = await prisma.story.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing || existing.id === excludeId) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

function revalidate() {
  revalidatePath('/admin/stories')
  revalidatePath('/dashboard')
}

export async function createStoryAction(input: StoryInput): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const parsed = storySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid story details' }
  }
  const data = parsed.data

  try {
    await requireStoryAudience(data.churchOnly ?? false)
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title))
    const story = await prisma.story.create({
      data: {
        title: data.title,
        slug,
        category: data.category || 'Good news',
        excerpt: data.excerpt ?? null,
        imageUrl: data.imageUrl ?? null,
        externalUrl: data.externalUrl ?? null,
        isPublished: data.isPublished ?? false,
        churchOnly: data.churchOnly ?? false,
        staffOnly: data.staffOnly ?? false,
        publishedAt: data.isPublished ? new Date() : null,
        sortOrder: data.sortOrder ?? 0,
      },
      select: { id: true },
    })
    revalidate()
    return { success: true, storyId: story.id }
  } catch (err) {
    console.error('createStoryAction failed', err)
    return { success: false, error: 'Could not create the story. Please try again.' }
  }
}

export async function updateStoryAction(storyId: string, input: StoryInput): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const parsed = storySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid story details' }
  }
  const data = parsed.data

  try {
    const existing = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, publishedAt: true, churchOnly: true },
    })
    if (!existing) return { success: false, error: 'Story not found' }

    // Both ends: you must own the story as it stands, and be allowed to publish
    // to the audience you're moving it to.
    try {
      await requireStoryAudience(existing.churchOnly)
      await requireStoryAudience(data.churchOnly ?? false)
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }

    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title), storyId)
    await prisma.story.update({
      where: { id: storyId },
      data: {
        title: data.title,
        slug,
        category: data.category || 'Good news',
        excerpt: data.excerpt ?? null,
        imageUrl: data.imageUrl ?? null,
        externalUrl: data.externalUrl ?? null,
        isPublished: data.isPublished ?? false,
        churchOnly: data.churchOnly ?? false,
        staffOnly: data.staffOnly ?? false,
        // Stamp publishedAt the first time it goes live; keep it thereafter.
        publishedAt: data.isPublished ? existing.publishedAt ?? new Date() : null,
        sortOrder: data.sortOrder ?? 0,
      },
    })
    revalidate()
    return { success: true, storyId }
  } catch (err) {
    console.error('updateStoryAction failed', err)
    return { success: false, error: 'Could not update the story. Please try again.' }
  }
}

export async function deleteStoryAction(storyId: string): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    const existing = await prisma.story.findUnique({
      where: { id: storyId },
      select: { churchOnly: true },
    })
    if (!existing) return { success: false, error: 'Story not found' }
    try {
      await requireStoryAudience(existing.churchOnly)
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
    await prisma.story.delete({ where: { id: storyId } })
    revalidate()
    return { success: true }
  } catch (err) {
    console.error('deleteStoryAction failed', err)
    return { success: false, error: 'Could not delete the story. Please try again.' }
  }
}
