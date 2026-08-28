'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { periodKey } from '@/lib/checklists'
import { isAdminRole } from '@/lib/permissions-core'
import { assertCapability } from '@/lib/permissions'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'

interface Result {
  success: boolean
  error?: string
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  await assertCapability('care.tasks')
  return session
}

/** Staff, trainees and admins can see and tick things off. */
async function requireStaff(): Promise<{ userId: string } | null> {
  const session = await getSession()
  if (!session) return null
  const u = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isStaff: true, isTrainee: true, role: true },
  })
  const ok = u?.isStaff || u?.isTrainee || isAdminRole(u?.role)
  return ok ? { userId: session.userId } : null
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  assignedToId: z.string().optional().or(z.literal('')),
  locationId: z.string().optional().or(z.literal('')),
  dueAt: z.string().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional().default('NORMAL'),
})
export type CreateTaskInput = z.input<typeof taskSchema>

export async function createTaskAction(input: CreateTaskInput): Promise<Result> {
  let session
  try {
    session = await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }

  const parsed = taskSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the details.' }
  const d = parsed.data

  // datetime-local is Brisbane wall-clock with no zone.
  const dueAt = d.dueAt ? new Date(d.dueAt.length === 16 ? `${d.dueAt}:00+10:00` : `${d.dueAt}+10:00`) : null

  const task = await prisma.staffTask.create({
    data: {
      title: d.title,
      description: d.description || null,
      assignedToId: d.assignedToId || null,
      locationId: d.locationId || null,
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      priority: d.priority ?? 'NORMAL',
      assignedById: session.userId,
    },
    select: { id: true, title: true, description: true, dueAt: true, assignedToId: true },
  })

  // Tell the person it's theirs. Best-effort — never fail the assignment on mail.
  if (task.assignedToId) {
    try {
      const to = await prisma.user.findUnique({
        where: { id: task.assignedToId },
        select: { email: true, name: true },
      })
      if (to?.email) {
        const firstName = to.name?.trim().split(/\s+/)[0] || 'there'
        const due = task.dueAt
          ? new Intl.DateTimeFormat('en-AU', {
              timeZone: 'Australia/Brisbane',
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).format(task.dueAt)
          : null
        await sendEmail({
          to: to.email,
          subject: `New task: ${task.title}`,
          html: wrapEmailHtml(
            `
            <p style="${P}">Hi ${firstName},</p>
            <p style="${P}">A new task has been assigned to you:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;width:100%;margin:6px 0 18px;">
              <tr><td style="padding:10px 14px;font-size:16px;font-weight:700;color:#9a3412;">${task.title}</td></tr>
              ${task.description ? `<tr><td style="padding:0 14px 12px;font-size:14px;color:#374151;">${task.description}</td></tr>` : ''}
              ${due ? `<tr><td style="padding:0 14px 12px;font-size:14px;color:#374151;"><strong>Due:</strong> ${due}</td></tr>` : ''}
            </table>
            <p style="margin:22px 0;"><a href="${APP_URL}/dashboard/tasks" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">View my tasks &rarr;</a></p>
            <p style="${P};margin-bottom:0;">Thanks,<br>The Lighthouse Care team</p>
          `,
            APP_URL
          ),
          text: `Hi ${firstName},\n\nA new task has been assigned to you:\n\n${task.title}\n${task.description ?? ''}${due ? `\nDue: ${due}` : ''}\n\nView your tasks: ${APP_URL}/dashboard/tasks\n\nThanks,\nThe Lighthouse Care team`,
        })
      }
    } catch (err) {
      console.error('task assignment email failed', err)
    }
  }

  revalidatePath('/admin/tasks')
  revalidatePath('/dashboard/tasks')
  return { success: true }
}

export async function setTaskStatusAction(taskId: string, done: boolean): Promise<Result> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'Staff only.' }
  await prisma.staffTask.update({
    where: { id: taskId },
    data: done
      ? { status: 'DONE', completedAt: new Date(), completedById: me.userId }
      : { status: 'OPEN', completedAt: null, completedById: null },
  })
  revalidatePath('/dashboard/tasks')
  revalidatePath('/admin/tasks')
  return { success: true }
}

export async function deleteTaskAction(taskId: string): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  await prisma.staffTask.delete({ where: { id: taskId } }).catch(() => {})
  revalidatePath('/admin/tasks')
  revalidatePath('/dashboard/tasks')
  return { success: true }
}

// ─── Recurring checklists ─────────────────────────────────────────────────────

const itemSchema = z.object({
  title: z.string().trim().min(1, 'Give the item a title').max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  locationId: z.string().optional().or(z.literal('')),
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 17:00')
    .optional()
    .or(z.literal('')),
  weekday: z.coerce.number().int().min(1).max(7).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  sortOrder: z.coerce.number().int().optional().default(0),
})
export type ChecklistItemInput = z.input<typeof itemSchema>

export async function upsertChecklistItemAction(
  input: ChecklistItemInput & { id?: string }
): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the details.' }
  const d = parsed.data

  const data = {
    title: d.title,
    description: d.description || null,
    frequency: d.frequency,
    locationId: d.locationId || null,
    dueTime: d.dueTime || null,
    weekday: d.frequency === 'WEEKLY' ? d.weekday ?? null : null,
    dayOfMonth: d.frequency === 'MONTHLY' ? d.dayOfMonth ?? null : null,
    sortOrder: d.sortOrder ?? 0,
  }

  if (input.id) await prisma.checklistItem.update({ where: { id: input.id }, data })
  else await prisma.checklistItem.create({ data })

  revalidatePath('/admin/checklists')
  revalidatePath('/dashboard/tasks')
  return { success: true }
}

export async function setChecklistItemActiveAction(id: string, isActive: boolean): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  await prisma.checklistItem.update({ where: { id }, data: { isActive } })
  revalidatePath('/admin/checklists')
  revalidatePath('/dashboard/tasks')
  return { success: true }
}

/**
 * Tick a recurring item off for its current period. Unique on (item, period), so
 * two people tapping at once can't double-complete it.
 */
export async function toggleChecklistAction(itemId: string, done: boolean): Promise<Result> {
  const me = await requireStaff()
  if (!me) return { success: false, error: 'Staff only.' }

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { frequency: true },
  })
  if (!item) return { success: false, error: 'That item no longer exists.' }

  const key = periodKey(item.frequency)
  if (done) {
    await prisma.checklistCompletion.upsert({
      where: { itemId_periodKey: { itemId, periodKey: key } },
      update: { completedById: me.userId, completedAt: new Date() },
      create: { itemId, periodKey: key, completedById: me.userId },
    })
  } else {
    await prisma.checklistCompletion
      .delete({ where: { itemId_periodKey: { itemId, periodKey: key } } })
      .catch(() => {})
  }

  revalidatePath('/dashboard/tasks')
  return { success: true }
}
