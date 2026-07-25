import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * Admin donation/donor permission. SUPER_ADMIN always has it; a regular ADMIN
 * only if granted `canViewDonations`. Gates the fundraising/donations admin
 * area (funds, fundraisers, events, transactions, donors) so volunteer-only
 * managers don't see donation amounts or donor personal data.
 */
export function canSeeDonations(user: { role: string | null; canViewDonations: boolean }): boolean {
  if (user.role === 'SUPER_ADMIN') return true
  return user.role === 'ADMIN' && user.canViewDonations === true
}

/** Boolean for nav/UI decisions (does the signed-in admin have donations access?). */
export async function getDonationsAccess(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, canViewDonations: true },
  })
  return !!user && canSeeDonations(user)
}

/** Page guard: redirect admins without donations access back to the dashboard. */
export async function requireDonationsAccess(): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) redirect('/login')
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, canViewDonations: true },
  })
  if (!user || !canSeeDonations(user)) redirect('/admin')
  return { userId: session.userId, role: session.role }
}
