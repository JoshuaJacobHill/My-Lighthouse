import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  KeyRound,
  HandHeart,
  Church,
  User as UserIcon,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { SignOutRow } from './SignOutRow'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Account' }

/**
 * The account screen.
 *
 * A list of destinations rather than one long scroll of forms. Everything that
 * used to be stacked here now has its own page, which suits a phone and means
 * the common case — changing a notification setting — is two taps instead of
 * scrolling past an address form.
 */
function Row({
  href,
  icon: Icon,
  title,
  hint,
  tone = 'plain',
}: {
  href: string
  icon: React.ElementType
  title: string
  hint?: string
  tone?: 'plain' | 'accent'
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-neutral-50"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' +
            (tone === 'accent' ? 'bg-orange-50 text-orange-600' : 'bg-neutral-100 text-neutral-500')
          }
        >
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-neutral-900">{title}</span>
          {hint && <span className="block truncate text-sm text-neutral-500">{hint}</span>}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden="true" />
    </Link>
  )
}

export default async function AccountPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      imageUrl: true,
      volunteerProfile: { select: { id: true } },
    },
  })
  if (!user) redirect('/login')

  const isVolunteer = Boolean(user.volunteerProfile)
  const hasTithe = Boolean(
    await prisma.donation.findFirst({
      where: { userId: session.userId, isTithe: true },
      select: { id: true },
    }),
  )

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Account</h1>

        {/* Who you are, and the way into your details. */}
        <Link
          href="/dashboard/account/details"
          className="mt-6 flex items-center justify-between gap-3 rounded-[28px] border border-neutral-200 p-4 transition-colors hover:bg-neutral-50"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-400">
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-neutral-900">{user.name ?? user.email}</span>
              <span className="block text-sm text-neutral-500">Personal info</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden="true" />
        </Link>

        <h2 className="mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">
          Settings
        </h2>
        <div className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
          <Row
            href="/dashboard/account/notifications"
            icon={Bell}
            title="Notifications"
            hint="What reaches you, and on which devices"
          />
          <Row
            href="/forgot-password"
            icon={KeyRound}
            title="Password"
            hint="We’ll email a secure link to change it"
          />
          {hasTithe && (
            <Row
              href="/dashboard/tithes"
              icon={Church}
              title="My tithes"
              hint="Manage your regular tithe"
              tone="accent"
            />
          )}
          <SignOutRow />
        </div>

        {!isVolunteer && (
          <Link
            href="/volunteer/apply"
            className="mt-6 flex items-center justify-between gap-4 rounded-[28px] border border-orange-200 bg-orange-50/60 p-5 transition-colors hover:bg-orange-50"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm">
                <HandHeart className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold text-neutral-900">
                  Want to volunteer with us?
                </span>
                <span className="block text-sm text-neutral-600">
                  Give your time alongside your generosity.
                </span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-orange-400" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}
