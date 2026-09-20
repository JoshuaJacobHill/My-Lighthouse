'use server'

import { revalidatePath } from 'next/cache'
import { notify, type Audience } from '@/lib/notifications'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { storySchema, type StoryInput } from '@/lib/validations'
import { can, isAdminRole, type PermissionUser } from '@/lib/permissions-core'
import { ruleFromInput, storyAudienceColumns, type AudienceRule } from '@/lib/audience-core'
import { notificationAudienceFor } from '@/lib/audience'

interface ActionResult {
  success: boolean
  error?: string
  storyId?: string
}

async function requireAdminSession() {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (!isAdminRole(session.role)) {
    throw new Error('Insufficient permissions')
  }
  return session
}

/**
 * Stories are the one thing both sides of the house write, so a story's
 * audience decides who may touch it: a story aimed at church members belongs to
 * the church manager, everything else to the Care side. Enforced here rather
 * than only in the form, because the audience arrives from the client and a
 * church manager could otherwise drop the audience and publish to every
 * volunteer.
 *
 * Still inferred from the audience rather than stated outright. Naming an owner
 * would be better — editing rights would stop moving as a side effect of
 * changing who may read something — but that needs a control on the form and a
 * decision about who owns a story aimed at several audiences at once.
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
    select: { role: true, canViewDonations: true, canViewBusinessReports: true },
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

/**
 * Tell people a story has gone live.
 *
 * The audience comes from the story's own audience rule, so a staff-only story
 * never reaches volunteers. Only fired the first time it publishes — editing a
 * typo should not tell 400 people to read it again.
 */
async function announceStory(story: { title: string; slug: string; rule: AudienceRule }, senderId?: string) {
  // Mirror exactly who can read it. Notifying somebody about a story they will
  // be refused is the failure this guards against, which is why it is derived
  // from the same rule the news page filters on rather than restated here.
  const audience: Audience = notificationAudienceFor(story.rule)

  await notify({
    audience,
    category: 'STORY',
    optional: 'stories',
    title: story.title,
    body: 'Lighthouse shared a good news story',
    href: `/dashboard/news?story=${encodeURIComponent(story.slug)}`,
    actionLabel: 'Read now',
    createdById: senderId,
    exceptUserId: senderId,
  })
}

export async function createStoryAction(input: StoryInput): Promise<ActionResult> {
  let session
  try {
    session = await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const parsed = storySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid story details' }
  }
  const data = parsed.data

  try {
    await requireStoryAudience(ruleFromInput(data, { canBePublic: false }).kinds.includes('church'))
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
        // The rule, plus the old booleans kept in step until every reader moves.
        ...storyAudienceColumns(ruleFromInput(data, { canBePublic: false })),
        publishedAt: data.isPublished ? new Date() : null,
        sortOrder: data.sortOrder ?? 0,
      },
      select: { id: true, title: true, slug: true },
    })
    revalidate()
    if (data.isPublished ?? false) {
      await announceStory(
        { title: story.title, slug: story.slug, rule: ruleFromInput(data, { canBePublic: false }) },
        session?.userId,
      )
    }
    return { success: true, storyId: story.id }
  } catch (err) {
    console.error('createStoryAction failed', err)
    return { success: false, error: 'Could not create the story. Please try again.' }
  }
}

export async function updateStoryAction(storyId: string, input: StoryInput): Promise<ActionResult> {
  let session
  try {
    session = await requireAdminSession()
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
      select: { id: true, publishedAt: true, isPublished: true, churchOnly: true },
    })
    if (!existing) return { success: false, error: 'Story not found' }

    // Both ends: you must own the story as it stands, and be allowed to publish
    // to the audience you're moving it to.
    try {
      await requireStoryAudience(existing.churchOnly)
      await requireStoryAudience(ruleFromInput(data, { canBePublic: false }).kinds.includes('church'))
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
        ...storyAudienceColumns(ruleFromInput(data, { canBePublic: false })),
        // Stamp publishedAt the first time it goes live; keep it thereafter.
        publishedAt: data.isPublished ? existing.publishedAt ?? new Date() : null,
        sortOrder: data.sortOrder ?? 0,
      },
    })
    revalidate()
    const goingLive = (data.isPublished ?? false) && !existing.isPublished
    if (goingLive) {
      await announceStory(
        { title: data.title, slug, rule: ruleFromInput(data, { canBePublic: false }) },
        session?.userId,
      )
    }
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
