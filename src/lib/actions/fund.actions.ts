'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { fundSchema, type FundInput } from '@/lib/validations'
import { isAdminRole } from '@/lib/permissions-core'
import { assertCapability } from '@/lib/permissions'

interface ActionResult {
  success: boolean
  error?: string
  fundId?: string
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdminSession(): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }
  await assertCapability('care.giving')
  return { userId: session.userId, role: session.role }
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Ensure a slug is unique across funds. If taken, append -2, -3, … . When
 * editing, the fund's own row is excluded so it can keep its slug.
 */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || 'fund'
  let candidate = root
  let n = 1
  // Loop until we find a slug not used by another fund.
  for (;;) {
    const existing = await prisma.fund.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === excludeId) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

// ─── Shared input → data mapping ────────────────────────────────────────────

function toDateOrNull(value: string | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createFundAction(input: FundInput): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const parsed = fundSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid fund details' }
  }
  const data = parsed.data

  try {
    const slugBase = data.slug ? slugify(data.slug) : slugify(data.name)
    const slug = await uniqueSlug(slugBase)

    const fund = await prisma.fund.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        goalAmount: data.goalAmount ?? null,
        startsAt: toDateOrNull(data.startsAt),
        endsAt: toDateOrNull(data.endsAt),
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        showPublicProgress: data.showPublicProgress ?? false,
        imageUrl: data.imageUrl ?? null,
        tagline: data.tagline ?? null,
        showOnDashboard: data.showOnDashboard ?? false,
        depositAccount: data.depositAccount ?? 'CARE',
        presetAmounts: data.presetAmounts ?? [],
        suggestedAmount: data.suggestedAmount ?? null,
        impactLabels: data.impactLabels ?? Prisma.JsonNull,
        defaultFrequency: data.defaultFrequency ?? null,
      },
      select: { id: true },
    })

    return { success: true, fundId: fund.id }
  } catch (err) {
    console.error('createFundAction failed', err)
    return { success: false, error: 'Could not create the fund. Please try again.' }
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateFundAction(
  fundId: string,
  input: FundInput
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const parsed = fundSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid fund details' }
  }
  const data = parsed.data

  try {
    const existing = await prisma.fund.findUnique({
      where: { id: fundId },
      select: { id: true },
    })
    if (!existing) return { success: false, error: 'Fund not found' }

    const slugBase = data.slug ? slugify(data.slug) : slugify(data.name)
    const slug = await uniqueSlug(slugBase, fundId)

    await prisma.fund.update({
      where: { id: fundId },
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        goalAmount: data.goalAmount ?? null,
        startsAt: toDateOrNull(data.startsAt),
        endsAt: toDateOrNull(data.endsAt),
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        showPublicProgress: data.showPublicProgress ?? false,
        imageUrl: data.imageUrl ?? null,
        tagline: data.tagline ?? null,
        showOnDashboard: data.showOnDashboard ?? false,
        depositAccount: data.depositAccount ?? 'CARE',
        presetAmounts: data.presetAmounts ?? [],
        suggestedAmount: data.suggestedAmount ?? null,
        impactLabels: data.impactLabels ?? Prisma.JsonNull,
        defaultFrequency: data.defaultFrequency ?? null,
      },
    })

    return { success: true, fundId }
  } catch (err) {
    console.error('updateFundAction failed', err)
    return { success: false, error: 'Could not update the fund. Please try again.' }
  }
}

// ─── Activate / deactivate ──────────────────────────────────────────────────

export async function toggleFundActiveAction(
  fundId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    await prisma.fund.update({
      where: { id: fundId },
      data: { isActive },
    })
    return { success: true, fundId }
  } catch (err) {
    console.error('toggleFundActiveAction failed', err)
    return { success: false, error: 'Could not update the fund. Please try again.' }
  }
}
