import prisma from '@/lib/prisma'

/**
 * Donor-facing giving helpers (donor portal — see docs/donor-portal-plan.md §8, §10).
 */

const BNE_OFFSET_MS = 10 * 60 * 60 * 1000 // Brisbane is UTC+10, no daylight saving.

/**
 * Australian financial year (1 July – 30 June) containing `ref`, as UTC instants
 * at the Brisbane day boundary, plus a "2026–2027" label.
 */
export function financialYearRange(ref: Date = new Date()): {
  start: Date
  end: Date
  label: string
} {
  const bne = new Date(ref.getTime() + BNE_OFFSET_MS)
  const month = bne.getUTCMonth() // 0 = Jan
  const startYear = month >= 6 ? bne.getUTCFullYear() : bne.getUTCFullYear() - 1
  const start = new Date(Date.UTC(startYear, 6, 1) - BNE_OFFSET_MS)
  const end = new Date(Date.UTC(startYear + 1, 6, 1) - BNE_OFFSET_MS)
  return { start, end, label: `${startYear}–${startYear + 1}` }
}

/**
 * Link any unclaimed gifts to this account by matching the payer email — but
 * ONLY when the account's email is verified (plan §8). Returns how many linked.
 */
export async function claimDonationsForUser(
  userId: string,
  email: string | null,
  emailVerified: Date | null
): Promise<number> {
  if (!email || !emailVerified) return 0
  const result = await prisma.donation.updateMany({
    where: { userId: null, donorEmail: { equals: email, mode: 'insensitive' } },
    data: { userId },
  })
  // Anyone who has tithed is a church member (sees church-only content).
  if (result.count > 0) {
    const tithe = await prisma.donation.findFirst({ where: { userId, isTithe: true }, select: { id: true } })
    if (tithe) await prisma.user.update({ where: { id: userId }, data: { isChurchMember: true } })
  }
  return result.count
}

export type DonorGift = {
  id: string
  amount: number
  currency: string
  createdAt: Date
  fundName: string | null
  isRecurring: boolean
  taxReceiptEligible: boolean
  description: string | null
  frequency: string | null
  paymentMethod: string | null
}

/** A donor's gifts, newest first, with the fund name resolved. */
export async function getDonorGifts(userId: string): Promise<DonorGift[]> {
  const gifts = await prisma.donation.findMany({
    // Tithes are kept separate — excluded from the giving total & history.
    where: { userId, isTithe: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      currency: true,
      createdAt: true,
      isRecurring: true,
      taxReceiptEligible: true,
      description: true,
      frequency: true,
      paymentMethod: true,
      fund: { select: { name: true } },
    },
  })
  return gifts.map((g) => ({
    id: g.id,
    amount: Number(g.amount),
    currency: g.currency,
    createdAt: g.createdAt,
    fundName: g.fund?.name ?? null,
    isRecurring: g.isRecurring,
    taxReceiptEligible: g.taxReceiptEligible,
    description: g.description,
    frequency: g.frequency,
    paymentMethod: g.paymentMethod,
  }))
}

/** Totals for the summary cards. */
export function summariseGifts(gifts: DonorGift[]): {
  allTime: number
  financialYear: number
  fyLabel: string
  count: number
} {
  const { start, end, label } = financialYearRange()
  let allTime = 0
  let fy = 0
  for (const g of gifts) {
    allTime += g.amount
    if (g.createdAt >= start && g.createdAt < end) fy += g.amount
  }
  return { allTime, financialYear: fy, fyLabel: label, count: gifts.length }
}
