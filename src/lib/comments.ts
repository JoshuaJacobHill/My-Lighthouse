/**
 * Comments on stories and tasks.
 *
 * Who may read a comment follows whoever may read the thing it is attached to —
 * a comment on a staff-only story is staff-only, and nothing here decides that
 * independently. Getting this wrong is how a private update leaks, so the
 * visibility check lives in one place and both reading and tagging use it.
 */

import prisma from '@/lib/prisma'
import { notify } from '@/lib/notifications'
import { isAdminRole } from '@/lib/permissions-core'

export type Viewer = {
  id: string
  role: string
  isStaff: boolean
  isTrainee: boolean
  isChurchMember: boolean
}

export type CommentView = {
  id: string
  body: string
  authorId: string
  authorName: string
  createdAt: Date
  editedAt: Date | null
  /** Whether the current viewer may remove it. */
  canDelete: boolean
  mentions: { userId: string; name: string }[]
}

/** Mirrors the news page's filter: staff-only needs staff, church-only needs church. */
export function canSeeStory(
  viewer: Viewer,
  story: { staffOnly: boolean; churchOnly: boolean; isPublished: boolean },
): boolean {
  if (!story.isPublished && !isAdminRole(viewer.role)) return false
  if (story.staffOnly && !(viewer.isStaff || viewer.isTrainee)) return false
  if (story.churchOnly && !viewer.isChurchMember) return false
  return true
}

/** The tasks area is staff-only, so seeing a task is the same test. */
export function canSeeTask(viewer: Viewer): boolean {
  return viewer.isStaff || viewer.isTrainee || isAdminRole(viewer.role)
}

function shape(
  rows: {
    id: string
    body: string
    authorId: string
    createdAt: Date
    editedAt: Date | null
    author: { name: string | null; email: string }
    mentions: { userId: string; user: { name: string | null; email: string } }[]
  }[],
  viewer: Viewer,
): CommentView[] {
  const admin = isAdminRole(viewer.role)
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    authorId: c.authorId,
    authorName: c.author.name ?? c.author.email,
    createdAt: c.createdAt,
    editedAt: c.editedAt,
    // Your own, or anyone's if you are an admin — same rule as the cheer wall.
    canDelete: c.authorId === viewer.id || admin,
    mentions: c.mentions.map((m) => ({ userId: m.userId, name: m.user.name ?? m.user.email })),
  }))
}

const SELECT = {
  id: true,
  body: true,
  authorId: true,
  createdAt: true,
  editedAt: true,
  author: { select: { name: true, email: true } },
  mentions: { select: { userId: true, user: { select: { name: true, email: true } } } },
} as const

export async function getStoryComments(storyId: string, viewer: Viewer): Promise<CommentView[]> {
  const rows = await prisma.comment.findMany({
    where: { storyId },
    orderBy: { createdAt: 'asc' },
    select: SELECT,
  })
  return shape(rows, viewer)
}

export async function getTaskComments(taskId: string, viewer: Viewer): Promise<CommentView[]> {
  const rows = await prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
    select: SELECT,
  })
  return shape(rows, viewer)
}

/** Comment counts for a set of stories, in one query rather than per card. */
export async function commentCounts(storyIds: string[]): Promise<Map<string, number>> {
  if (storyIds.length === 0) return new Map()
  const rows = await prisma.comment.groupBy({
    by: ['storyId'],
    where: { storyId: { in: storyIds } },
    _count: { _all: true },
  })
  return new Map(rows.map((r) => [r.storyId!, r._count._all]))
}

/**
 * Who may be tagged: only people who can already see the thing. Tagging
 * someone into a conversation they cannot open would be worse than useless —
 * they would get a notification leading to a 404 or, worse, a hint about
 * content meant to be private.
 */
export async function taggableUsers(
  target: { storyId?: string; taskId?: string },
): Promise<{ id: string; name: string }[]> {
  let where: Parameters<typeof prisma.user.findMany>[0]

  if (target.taskId) {
    where = { where: { isActive: true, OR: [{ isStaff: true }, { isTrainee: true }] } }
  } else {
    const story = await prisma.story.findUnique({
      where: { id: target.storyId! },
      select: { staffOnly: true, churchOnly: true },
    })
    if (!story) return []
    const AND: Record<string, unknown>[] = []
    if (story.staffOnly) AND.push({ OR: [{ isStaff: true }, { isTrainee: true }] })
    if (story.churchOnly) AND.push({ isChurchMember: true })
    where = { where: { isActive: true, ...(AND.length ? { AND } : {}) } }
  }

  const users = await prisma.user.findMany({
    ...where,
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 500,
  })
  return users.map((u) => ({ id: u.id, name: u.name ?? u.email }))
}

/**
 * Tell the people involved.
 *
 * A thread you have spoken in, or been tagged into, or own — not everyone who
 * can see the story. One chatty story would otherwise put a few thousand
 * notifications through the system and teach everybody to ignore the bell.
 */
export async function notifyOnComment(input: {
  storyId?: string
  taskId?: string
  commentId: string
  authorId: string
  authorName: string
  mentionedIds: string[]
  /** Title of the story or task, for the notification. */
  subject: string
  href: string
}): Promise<void> {
  const { storyId, taskId, authorId } = input

  // Everyone who has already spoken here.
  const prior = await prisma.comment.findMany({
    where: storyId ? { storyId } : { taskId },
    select: { authorId: true },
    distinct: ['authorId'],
  })
  const involved = new Set(prior.map((p) => p.authorId))

  // A task's assignee and the person who handed it out.
  if (taskId) {
    const task = await prisma.staffTask.findUnique({
      where: { id: taskId },
      select: { assignedToId: true, assignedById: true },
    })
    if (task?.assignedToId) involved.add(task.assignedToId)
    if (task?.assignedById) involved.add(task.assignedById)
  }

  for (const id of input.mentionedIds) involved.add(id)
  involved.delete(authorId)
  if (involved.size === 0) return

  // Tagged people get told they were tagged; everyone else that there is a reply.
  const tagged = new Set(input.mentionedIds.filter((id) => id !== authorId))
  const others = [...involved].filter((id) => !tagged.has(id))

  if (tagged.size > 0) {
    await notify({
      audience: { kind: 'users', ids: [...tagged] },
      category: storyId ? 'STORY' : 'TASK',
      title: input.subject,
      body: `${input.authorName} tagged you in a comment`,
      href: input.href,
      actionLabel: 'View comment',
      createdById: authorId,
    })
  }

  if (others.length > 0) {
    await notify({
      audience: { kind: 'users', ids: others },
      category: storyId ? 'STORY' : 'TASK',
      title: input.subject,
      body: `${input.authorName} commented`,
      href: input.href,
      actionLabel: 'View comment',
      createdById: authorId,
    })
  }
}
