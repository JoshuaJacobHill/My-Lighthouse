import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/layout/PortalShell'
import prisma from '@/lib/prisma'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      volunteerProfile: { select: { id: true } },
      _count: { select: { donations: true } },
    },
  })

  return (
    <PortalShell
      userName={user?.name ?? 'Volunteer'}
      isVolunteer={Boolean(user?.volunteerProfile)}
      hasGiven={(user?._count.donations ?? 0) > 0}
    >
      {children}
    </PortalShell>
  )
}
