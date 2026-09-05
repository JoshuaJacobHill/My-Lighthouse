import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUnreadCount } from '@/lib/notifications-data'
import { hasCapability } from '@/lib/permissions'
import { canAccessDonorPortal } from '@/lib/features'
import { PortalShell } from '@/components/layout/PortalShell'
import { isAdminRole } from '@/lib/permissions-core'

/**
 * Portal layout — the shared shell for donors and volunteers.
 *
 * While DONOR_PORTAL_ENABLED is off, only early-access accounts and admins can
 * reach this area; everyone else gets a 404 (notFound).
 */
export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Everything here came back with the session query, so there is no second
  // round trip. This used to be a serial findUnique on every dashboard page.
  const user = session.user
  const [unreadCount, canSeeReports] = await Promise.all([
    getUnreadCount(session.userId),
    hasCapability('business.reports'),
  ])

  if (!canAccessDonorPortal({ email: user.email, role: user.role })) {
    notFound()
  }

  return (
    <PortalShell
      unreadCount={unreadCount}
      canSeeReports={canSeeReports}
      userName={user.name ?? 'Friend'}
      isVolunteer={user.hasVolunteerProfile}
      hasGiven={user.donationCount > 0}
      isStaff={user.isStaff || user.isTrainee}
      isAdmin={isAdminRole(user.role)}
    >
      {children}
    </PortalShell>
  )
}
