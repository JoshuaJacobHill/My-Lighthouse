/**
 * Comments for a page of stories, in one query.
 *
 * Fetched alongside the stories so opening one stays instant — the modal is
 * the fastest thing in the portal and a round trip on click would spend that.
 */

import prisma from '@/lib/prisma'
import { isAdminRole } from '@/lib/permissions-core'
import type { CommentView, Viewer } from '@/lib/comments'

const SELECT = {
  id: true,
  body: true,
  authorId: true,
  storyId: true,
  taskId: true,
  createdAt: true,
  editedAt: true,
  author: { select: { name: true, email: true } },
  mentions: { select: { userId: true, user: { select: { name: true, email: true } } } },
} as const

function shape(
  c: {
    id: string
    body: string
    authorId: string
    createdAt: Date
    editedAt: Date | null
    author: { name: string | null; email: string }
    mentions: { userId: string; user: { name: string | null; email: string } }[]
  },
  viewer: Viewer,
  admin: boolean,
): CommentView {
  return {
    id: c.id,
    body: c.body,
    authorId: c.authorId,
    authorName: c.author.name ?? c.author.email,
    createdAt: c.createdAt,
    editedAt: c.editedAt,
    canDelete: c.authorId === viewer.id || admin,
    mentions: c.mentions.map((m) => ({ userId: m.userId, name: m.user.name ?? m.user.email })),
  }
}

/** Comments for a page of tasks, in one query. */
export async function commentsForTasks(
  taskIds: string[],
  viewer: Viewer,
): Promise<Record<string, CommentView[]>> {
  if (taskIds.length === 0) return {}
  const rows = await prisma.comment.findMany({
    where: { taskId: { in: taskIds } },
    orderBy: { createdAt: 'asc' },
    select: SELECT,
  })
  const admin = isAdminRole(viewer.role)
  const out: Record<string, CommentView[]> = {}
  for (const c of rows) {
    const list = out[c.taskId!] ?? []
    list.push(shape(c, viewer, admin))
    out[c.taskId!] = list
  }
  return out
}

export async function commentsForStories(
  storyIds: string[],
  viewer: Viewer,
): Promise<Record<string, CommentView[]>> {
  if (storyIds.length === 0) return {}

  const rows = await prisma.comment.findMany({
    where: { storyId: { in: storyIds } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      authorId: true,
      storyId: true,
      createdAt: true,
      editedAt: true,
      author: { select: { name: true, email: true } },
      mentions: { select: { userId: true, user: { select: { name: true, email: true } } } },
    },
  })

  const admin = isAdminRole(viewer.role)
  const out: Record<string, CommentView[]> = {}
  for (const c of rows) {
    const list = out[c.storyId!] ?? []
    list.push({
      id: c.id,
      body: c.body,
      authorId: c.authorId,
      authorName: c.author.name ?? c.author.email,
      createdAt: c.createdAt,
      editedAt: c.editedAt,
      canDelete: c.authorId === viewer.id || admin,
      mentions: c.mentions.map((m) => ({ userId: m.userId, name: m.user.name ?? m.user.email })),
    })
    out[c.storyId!] = list
  }
  return out
}
