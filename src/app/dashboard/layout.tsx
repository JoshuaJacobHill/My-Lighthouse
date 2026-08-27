import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canAccessDonorPortal } from '@/lib/features'
import { PortalShell } from '@/components/layout/PortalShell'

/**
 * Portal layout — the shared shell for donors and volunteers.
 *
 * While DONOR_PORTAL_ENABLED is off, only early-access accounts and admins can
 * reach this area; everyone else gets a 404 (notFound).
 */
export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      role: true,
      isStaff: true,
      isTrainee: true,
      volunteerProfile: { select: { id: true } },
      _count: { select: { donations: true } },
    },
  })
  if (!user) redirect('/login')

  if (!canAccessDonorPortal({ email: user.email, role: user.role })) {
    notFound()
  }

  return (
    <PortalShell
      userName={user.name ?? 'Friend'}
      isVolunteer={Boolean(user.volunteerProfile)}
      hasGiven={(user._count.donations ?? 0) > 0}
      isStaff={user.isStaff || user.isTrainee}
    >
      {children}
    </PortalShell>
  )
}
