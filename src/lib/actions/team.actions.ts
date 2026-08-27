'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

type Result = { success: boolean; error?: string }

async function requireChurchMember() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isChurchMember: true },
  })
  if (!user?.isChurchMember) return null
  return user
}

/** A church member registers interest in a serving team. */
export async function expressTeamInterestAction(teamId: string): Promise<Result> {
  const user = await requireChurchMember()
  if (!user) return { success: false, error: 'Not available.' }
  const team = await prisma.servingTeam.findFirst({ where: { id: teamId, isActive: true }, select: { id: true } })
  if (!team) return { success: false, error: 'That team isn’t available.' }
  await prisma.teamInterest.upsert({
    where: { userId_teamId: { userId: user.id, teamId } },
    update: { status: 'INTERESTED' },
    create: { userId: user.id, teamId, status: 'INTERESTED' },
  })
  revalidatePath('/volunteer')
  return { success: true }
}

export async function withdrawTeamInterestAction(teamId: string): Promise<Result> {
  const user = await requireChurchMember()
  if (!user) return { success: false, error: 'Not available.' }
  await prisma.teamInterest.deleteMany({ where: { userId: user.id, teamId } })
  revalidatePath('/volunteer')
  return { success: true }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    throw new Error('Insufficient permissions')
  }
}

export async function createServingTeamAction(input: { name: string; description?: string }): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  const name = input.name?.trim()
  if (!name) return { success: false, error: 'Please enter a team name.' }
  const max = await prisma.servingTeam.aggregate({ _max: { sortOrder: true } })
  await prisma.servingTeam.create({
    data: { name, description: input.description?.trim() || null, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  })
  revalidatePath('/admin/teams')
  revalidatePath('/volunteer')
  return { success: true }
}

export async function setServingTeamActiveAction(teamId: string, isActive: boolean): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  await prisma.servingTeam.update({ where: { id: teamId }, data: { isActive } })
  revalidatePath('/admin/teams')
  revalidatePath('/volunteer')
  return { success: true }
}

/** Admin: mark a user as a church member (or not). */
export async function setChurchMemberAction(userId: string, isChurchMember: boolean): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  await prisma.user.update({ where: { id: userId }, data: { isChurchMember } })
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

export async function setStaffAction(userId: string, isStaff: boolean): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  await prisma.user.update({ where: { id: userId }, data: { isStaff } })
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

export async function setTraineeAction(userId: string, isTrainee: boolean): Promise<Result> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
  await prisma.user.update({ where: { id: userId }, data: { isTrainee } })
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}
