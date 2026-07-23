import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LogOut, Heart } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canAccessDonorPortal } from '@/lib/features'
import { logoutAction } from '@/lib/actions/auth.actions'

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/donor" className="flex items-center gap-2">
            <Image
              src="/logo-inline-black.png"
              alt="Lighthouse Care"
              width={150}
              height={40}
              className="h-7 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/donate"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
            >
              <Heart className="h-4 w-4" /> Donate
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
