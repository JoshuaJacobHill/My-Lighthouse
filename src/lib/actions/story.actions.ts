'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { storySchema, type StoryInput } from '@/lib/validations'

interface ActionResult {
  success: boolean
  error?: string
  storyId?: string
}

async function requireAdminSession(): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new Error('Insufficient permissions')
  }
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
  revalidatePath('/donor')
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
      select: { id: true, publishedAt: true },
    })
    if (!existing) return { success: false, error: 'Story not found' }

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
    await prisma.story.delete({ where: { id: storyId } })
    revalidate()
    return { success: true }
  } catch (err) {
    console.error('deleteStoryAction failed', err)
    return { success: false, error: 'Could not delete the story. Please try again.' }
  }
}
