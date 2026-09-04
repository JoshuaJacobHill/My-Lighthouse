'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isAdminRole } from '@/lib/permissions-core'
import {
  canSeeStory,
  canSeeTask,
  notifyOnComment,
  taggableUsers,
  type Viewer,
} from '@/lib/comments'

type Result = { success: boolean; error?: string }

const schema = z.object({
  storyId: z.string().optional(),
  taskId: z.string().optional(),
  body: z.string().trim().min(1, 'Write something first').max(2000, 'That is a bit long'),
  mentionedIds: z.array(z.string()).max(20).optional(),
})

async function viewer(): Promise<Viewer | null> {
  const session = await getSession()
  if (!session) return null
  return {
    id: session.userId,
    role: session.role,
    isStaff: session.user.isStaff,
    isTrainee: session.user.isTrainee,
    isChurchMember: session.user.isChurchMember,
  }
}

/** Post a comment on a story or a task. */
export async function postCommentAction(input: {
  storyId?: string
  taskId?: string
  body: string
  mentionedIds?: string[]
}): Promise<Result & { id?: string }> {
  const me = await viewer()
  if (!me) return { success: false, error: 'Not signed in.' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Check that.' }
  }
  const d = parsed.data
  if (Boolean(d.storyId) === Boolean(d.taskId)) {
    return { success: false, error: 'A comment belongs to one story or one task.' }
  }

  // You may only comment where you may read.
  let subject: string
  let href: string
  if (d.storyId) {
    const story = await prisma.story.findUnique({
      where: { id: d.storyId },
      select: { title: true, slug: true, staffOnly: true, churchOnly: true, isPublished: true },
    })
    if (!story || !canSeeStory(me, story)) return { success: false, error: 'Not found.' }
    subject = story.title
    href = `/dashboard/news?story=${encodeURIComponent(story.slug)}`
  } else {
    if (!canSeeTask(me)) return { success: false, error: 'Not found.' }
    const task = await prisma.staffTask.findUnique({
      where: { id: d.taskId! },
      select: { title: true },
    })
    if (!task) return { success: false, error: 'Not found.' }
    subject = task.title
    href = '/dashboard/tasks'
  }

  // Only people who can already see it may be tagged, so a mention can never
  // point someone at something they are not allowed to open.
  const allowed = new Set(
    (await taggableUsers({ storyId: d.storyId, taskId: d.taskId })).map((u) => u.id),
  )
  const mentionedIds = [...new Set(d.mentionedIds ?? [])].filter(
    (id) => allowed.has(id) && id !== me.id,
  )

  const comment = await prisma.comment.create({
    data: {
      body: d.body,
      authorId: me.id,
      storyId: d.storyId ?? null,
      taskId: d.taskId ?? null,
      ...(mentionedIds.length
        ? { mentions: { createMany: { data: mentionedIds.map((userId) => ({ userId })) } } }
        : {}),
    },
    select: { id: true, author: { select: { name: true, email: true } } },
  })

  // Best-effort: a comment must not fail because telling people failed.
  try {
    await notifyOnComment({
      storyId: d.storyId,
      taskId: d.taskId,
      commentId: comment.id,
      authorId: me.id,
      authorName: comment.author.name ?? comment.author.email,
      mentionedIds,
      subject,
      href,
    })
  } catch (err) {
    console.error('comment notification failed', err)
  }

  revalidatePath('/dashboard/news')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard')
  return { success: true, id: comment.id }
}

/** Remove a comment. Your own, or anyone's if you are an admin. */
export async function deleteCommentAction(commentId: string): Promise<Result> {
  const me = await viewer()
  if (!me) return { success: false, error: 'Not signed in.' }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  })
  if (!comment) return { success: true }
  if (comment.authorId !== me.id && !isAdminRole(me.role)) {
    return { success: false, error: 'That is not yours to remove.' }
  }

  await prisma.comment.delete({ where: { id: commentId } })
  revalidatePath('/dashboard/news')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard')
  return { success: true }
}

/** People the current user may tag on this story or task. */
export async function taggableUsersAction(input: {
  storyId?: string
  taskId?: string
}): Promise<{ id: string; name: string }[]> {
  const me = await viewer()
  if (!me) return []
  if (input.taskId && !canSeeTask(me)) return []
  if (input.storyId) {
    const story = await prisma.story.findUnique({
      where: { id: input.storyId },
      select: { staffOnly: true, churchOnly: true, isPublished: true },
    })
    if (!story || !canSeeStory(me, story)) return []
  }
  const all = await taggableUsers(input)
  return all.filter((u) => u.id !== me.id)
}
