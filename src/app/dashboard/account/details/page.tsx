import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AccountSettingsForm } from '@/components/donor/AccountSettingsForm'
import { LinkedEmails } from '@/components/donor/LinkedEmails'
import { AvatarUpload } from './AvatarUpload'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Personal info' }

export default async function AccountDetailsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      company: true,
      imageUrl: true,
      donorProfile: { select: { phone: true, address: true, consentEmailUpdates: true } },
      volunteerProfile: { select: { id: true, emergencyName: true, emergencyPhone: true } },
      extraEmails: {
        select: { id: true, email: true, verifiedAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!user) redirect('/login')

  const isVolunteer = Boolean(user.volunteerProfile)
  const hasEmergency = Boolean(user.volunteerProfile?.emergencyName)

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/account"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Account
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Personal info</h1>

        <div className="mt-7">
          <AvatarUpload initial={user.imageUrl} name={user.name ?? user.email} />
        </div>

        <div className="mt-7">
          <AccountSettingsForm
            initial={{
              name: user.name ?? '',
              email: user.email,
              company: user.company ?? '',
              phone: user.donorProfile?.phone ?? '',
              address: user.donorProfile?.address ?? '',
              consentEmailUpdates: user.donorProfile?.consentEmailUpdates ?? false,
            }}
          />
        </div>

        <LinkedEmails
          primary={user.email}
          emails={user.extraEmails.map((e) => ({
            id: e.id,
            email: e.email,
            verified: e.verifiedAt !== null,
          }))}
        />

        {/* Emergency contact lives on the volunteer profile, which is where it
            is already edited. Linking rather than repeating the fields keeps
            one source of truth — two forms writing the same three columns is
            how they end up disagreeing. */}
        {isVolunteer && (
          <Link
            href="/volunteer/profile"
            className="mt-6 flex items-center justify-between rounded-[28px] border border-neutral-200 p-5 transition-colors hover:bg-neutral-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">Emergency contact</p>
                <p className="text-sm text-neutral-500">
                  {hasEmergency
                    ? `${user.volunteerProfile?.emergencyName} · ${user.volunteerProfile?.emergencyPhone ?? 'no number'}`
                    : 'Needed for volunteering — not set yet'}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}
