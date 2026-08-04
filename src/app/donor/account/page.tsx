import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, KeyRound, HandHeart, ArrowRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AccountSettingsForm } from '@/components/donor/AccountSettingsForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Account settings' }

export default async function DonorAccountPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      donorProfile: { select: { phone: true, address: true, consentEmailUpdates: true } },
      volunteerProfile: { select: { id: true } },
    },
  })
  if (!user) redirect('/login')

  const isVolunteer = Boolean(user.volunteerProfile)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/donor"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Account settings</h1>
      <p className="mt-1.5 text-gray-500">Update your details and preferences.</p>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <AccountSettingsForm
          initial={{
            name: user.name ?? '',
            email: user.email,
            phone: user.donorProfile?.phone ?? '',
            address: user.donorProfile?.address ?? '',
            consentEmailUpdates: user.donorProfile?.consentEmailUpdates ?? false,
          }}
        />
      </div>

      {/* Password */}
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-gray-900">Password</p>
            <p className="text-sm text-gray-500">We&rsquo;ll email you a secure link to change it.</p>
          </div>
        </div>
        <Link
          href="/forgot-password"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Change password
        </Link>
      </div>

      {/* Volunteer sign-up */}
      {!isVolunteer && (
        <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm">
              <HandHeart className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-gray-900">Want to volunteer with us?</p>
              <p className="text-sm text-gray-600">Give your time alongside your generosity.</p>
            </div>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Sign up to volunteer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
