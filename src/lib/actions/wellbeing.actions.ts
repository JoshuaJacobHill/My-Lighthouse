'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { assertCapability } from '@/lib/permissions'

/** Managing the weekly wellbeing schedule from admin. */

interface Result {
  success: boolean
  error?: string
  id?: string
}

const schema = z.object({
  title: z.string().trim().min(2, 'Give it a name.').max(120),
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must look like 08:00.'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'End time must look like 09:00.')
    .optional()
    .or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  leader: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
})
export type WellbeingSessionInput = z.input<typeof schema>

function clean(data: z.output<typeof schema>) {
  return {
    title: data.title,
    weekday: data.weekday,
    startTime: data.startTime,
    endTime: data.endTime || null,
    location: data.location || null,
    leader: data.leader || null,
    notes: data.notes || null,
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder ?? 0,
  }
}

function refresh() {
  revalidatePath('/admin/settings/schedule')
  revalidatePath('/dashboard/fitness')
}

export async function createWellbeingSessionAction(input: WellbeingSessionInput): Promise<Result> {
  try {
    await assertCapability('care.people')
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check the details.' }

  try {
    const row = await prisma.wellbeingSession.create({ data: clean(parsed.data), select: { id: true } })
    refresh()
    return { success: true, id: row.id }
  } catch (err) {
    console.error('createWellbeingSessionAction failed', err)
    return { success: false, error: 'Could not save that. Please try again.' }
  }
}

export async function updateWellbeingSessionAction(id: string, input: WellbeingSessionInput): Promise<Result> {
  try {
    await assertCapability('care.people')
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check the details.' }

  try {
    await prisma.wellbeingSession.update({ where: { id }, data: clean(parsed.data) })
    refresh()
    return { success: true, id }
  } catch (err) {
    console.error('updateWellbeingSessionAction failed', err)
    return { success: false, error: 'Could not save that. Please try again.' }
  }
}

export async function deleteWellbeingSessionAction(id: string): Promise<Result> {
  try {
    await assertCapability('care.people')
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    await prisma.wellbeingSession.delete({ where: { id } })
    refresh()
    return { success: true }
  } catch (err) {
    console.error('deleteWellbeingSessionAction failed', err)
    return { success: false, error: 'Could not delete that. Please try again.' }
  }
}
