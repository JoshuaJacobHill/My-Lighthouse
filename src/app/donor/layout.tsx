import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canAccessDonorPortal } from '@/lib/features'

/**
 * Donor portal layout — gated.
 *
 * While DONOR_PORTAL_ENABLED is off, only early-access accounts and admins can
 * reach this area; everyone else gets a 404 (notFound), so the portal is
 * invisible to volunteers and the public during the build.
 */
export default async function DonorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, role: true },
  })
  if (!user) redirect('/login')

  if (!canAccessDonorPortal({ email: user.email, role: user.role })) {
    notFound()
  }

  return <div className="min-h-screen bg-gray-50">{children}</div>
}
