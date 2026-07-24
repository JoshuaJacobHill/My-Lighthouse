'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  fundraiserSchema,
  offlineDonationSchema,
  type FundraiserInput,
  type OfflineDonationInput,
} from '@/lib/validations'

interface ActionResult {
  success: boolean
  error?: string
  fundraiserId?: string
}

async function requireAdminSession(): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new Error('Insufficient permissions')
  }
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || 'fundraiser'
  let candidate = root
  let n = 1
  for (;;) {
    const existing = await prisma.fundraiser.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing || existing.id === excludeId) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

// ─── Create / update fundraiser ───────────────────────────────────────────────

export async function createFundraiserAction(input: FundraiserInput): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  const parsed = fundraiserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' }
  const data = parsed.data

  try {
    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title))
    const fr = await prisma.fundraiser.create({
      data: {
        title: data.title,
        slug,
        story: data.story,
        imageUrl: data.imageUrl ?? null,
        goalAmount: data.goalAmount ?? null,
        organiserName: data.organiserName,
        organiserEmail: data.organiserEmail || null,
        fundId: data.fundId,
        isActive: data.isActive ?? true,
      },
      select: { id: true },
    })
    return { success: true, fundraiserId: fr.id }
  } catch (err) {
    console.error('createFundraiserAction failed', err)
    return { success: false, error: 'Could not create the fundraiser. Please try again.' }
  }
}

export async function updateFundraiserAction(
  fundraiserId: string,
  input: FundraiserInput
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  const parsed = fundraiserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid details' }
  const data = parsed.data

  try {
    const existing = await prisma.fundraiser.findUnique({ where: { id: fundraiserId }, select: { id: true } })
    if (!existing) return { success: false, error: 'Fundraiser not found' }
    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title), fundraiserId)
    await prisma.fundraiser.update({
      where: { id: fundraiserId },
      data: {
        title: data.title,
        slug,
        story: data.story,
        imageUrl: data.imageUrl ?? null,
        goalAmount: data.goalAmount ?? null,
        organiserName: data.organiserName,
        organiserEmail: data.organiserEmail || null,
        fundId: data.fundId,
        isActive: data.isActive ?? true,
      },
    })
    return { success: true, fundraiserId }
  } catch (err) {
    console.error('updateFundraiserAction failed', err)
    return { success: false, error: 'Could not update the fundraiser. Please try again.' }
  }
}

export async function toggleFundraiserActiveAction(
  fundraiserId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    await prisma.fundraiser.update({ where: { id: fundraiserId }, data: { isActive } })
    return { success: true, fundraiserId }
  } catch (err) {
    console.error('toggleFundraiserActiveAction failed', err)
    return { success: false, error: 'Could not update the fundraiser. Please try again.' }
  }
}

// ─── Offline donations (migrated / manually recorded) ─────────────────────────

export async function addOfflineDonationAction(input: OfflineDonationInput): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  const parsed = offlineDonationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid donation' }
  const data = parsed.data

  try {
    const fundraiser = await prisma.fundraiser.findUnique({
      where: { id: data.fundraiserId },
      select: { id: true, fundId: true },
    })
    if (!fundraiser) return { success: false, error: 'Fundraiser not found' }

    const createdAt = data.donatedAt ? new Date(`${data.donatedAt}T00:00:00+10:00`) : new Date()

    await prisma.donation.create({
      data: {
        donorEmail: '', // offline gifts often have no email
        donorName: data.donorName || null,
        message: data.message || null,
        amount: data.amount,
        currency: 'AUD',
        provider: 'OFFLINE',
        providerTransactionId: null, // no gateway transaction
        fundId: fundraiser.fundId,
        fundraiserId: fundraiser.id,
        source: 'OFFLINE',
        taxReceiptEligible: true,
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      },
    })
    return { success: true, fundraiserId: fundraiser.id }
  } catch (err) {
    console.error('addOfflineDonationAction failed', err)
    return { success: false, error: 'Could not record the donation. Please try again.' }
  }
}

/** Remove an offline / imported donation (corrections). OFFLINE source only. */
export async function deleteOfflineDonationAction(donationId: string): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      select: { source: true, fundraiserId: true },
    })
    if (!donation) return { success: false, error: 'Donation not found' }
    if (donation.source !== 'OFFLINE') {
      return { success: false, error: 'Only offline donations can be removed here.' }
    }
    await prisma.donation.delete({ where: { id: donationId } })
    return { success: true, fundraiserId: donation.fundraiserId ?? undefined }
  } catch (err) {
    console.error('deleteOfflineDonationAction failed', err)
    return { success: false, error: 'Could not remove the donation. Please try again.' }
  }
}
