import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/layout/PortalShell'
import { isAdminRole } from '@/lib/permissions-core'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Came back with the session; this used to be a second serial query.
  const user = session.user

  return (
    <PortalShell
      userName={user.name ?? 'Volunteer'}
      isVolunteer={user.hasVolunteerProfile}
      hasGiven={user.donationCount > 0}
      isAdmin={isAdminRole(user.role)}
    >
      {children}
    </PortalShell>
  )
}
