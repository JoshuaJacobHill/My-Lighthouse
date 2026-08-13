import prisma from '@/lib/prisma'

/**
 * Resolve the company a supporter represents, in priority order:
 *   1. the company they set explicitly on their profile,
 *   2. a company on their giving (donorCompany),
 *   3. inferred — they were the contact for a corporate volunteer session
 *      (i.e. they've "volunteered as a company"), matched by email.
 * Returns their identity too, for pre-filling enquiries.
 */
export async function resolveUserCompany(
  userId: string
): Promise<{ company: string | null; email: string | null; name: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { company: true, email: true, name: true },
  })
  if (!user) return { company: null, email: null, name: null }

  if (user.company?.trim()) {
    return { company: user.company.trim(), email: user.email, name: user.name }
  }

  const gift = await prisma.donation.findFirst({
    where: { userId, donorCompany: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { donorCompany: true },
  })
  if (gift?.donorCompany) {
    return { company: gift.donorCompany, email: user.email, name: user.name }
  }

  if (user.email) {
    const sess = await prisma.corporateVolunteerSession.findFirst({
      where: { contactEmail: { equals: user.email, mode: 'insensitive' } },
      orderBy: { date: 'desc' },
      select: { companyName: true },
    })
    if (sess?.companyName) {
      return { company: sess.companyName, email: user.email, name: user.name }
    }
  }

  return { company: null, email: user.email, name: user.name }
}
