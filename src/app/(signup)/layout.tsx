import { getSession } from '@/lib/auth'
import { getUnreadCount } from '@/lib/notifications-data'
import { hasCapability } from '@/lib/permissions'
import { PortalShell } from '@/components/layout/PortalShell'
import { isAdminRole } from '@/lib/permissions-core'
import Link from 'next/link'
import Image from 'next/image'

/**
 * Chrome for the volunteer application.
 *
 * The form is public, but most people who open it are already signed in — a
 * donor adding volunteering to the account they're already using. Wrapping it
 * in the marketing layout gave those people a site footer under a half-finished
 * form and, worse, took the bottom nav away mid-application. So the route sits
 * in its own group and picks its chrome from who is asking:
 *
 *   signed in → PortalShell, exactly like every other page of the app
 *   a guest   → the same white canvas with a slim app top bar
 *
 * A guest deliberately does not get the marketing header either. Its dark bar
 * and hamburger full of site links read as a different product to the form
 * underneath it; applying to volunteer should feel like the app, not like a
 * page of the website. PortalShell itself is wrong for a guest — its menu and
 * bottom tabs all lead to pages that need an account — so guests get a bar with
 * the logo and one way in.
 */
export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (session) {
    const user = session.user
    // Both came back on the session query or are a single lookup; the shell
    // needs them to compose the same menu the rest of the app shows.
    const [unreadCount, canSeeReports] = await Promise.all([
      getUnreadCount(session.userId),
      hasCapability('business.reports'),
    ])

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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <Link href="/" aria-label="Lighthouse Care — home" className="flex items-center">
          <Image
            src="/logo-inline-black.png"
            alt="Lighthouse Care"
            width={180}
            height={48}
            className="h-7 w-auto"
            priority
          />
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Sign in
        </Link>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  )
}
