import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart } from 'lucide-react'
import prisma from '@/lib/prisma'
import { resolveAccount } from '@/lib/stripe-accounts'
import { getLiveMigrationIntent, isMigrationFrequency } from '@/lib/migration'
import { ResumeGivingForm } from './ResumeGivingForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Keep your giving going — Lighthouse Care' }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Image src="/logo-inline-black.png" alt="Lighthouse Care" width={180} height={48} className="h-9 w-auto" />
        </div>
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-neutral-400">
          Need a hand? <a href="https://lighthousecare.org.au/contact/" className="font-medium text-orange-600 hover:underline">Contact us</a>
        </p>
      </div>
    </main>
  )
}

export default async function ResumeGivingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await getLiveMigrationIntent(token)

  if (!result) {
    return (
      <Shell>
        <div className="text-center">
          <Heart className="mx-auto h-8 w-8 text-orange-400" />
          <h1 className="mt-3 text-xl font-bold text-neutral-900">This link isn’t valid</h1>
          <p className="mt-2 text-sm text-neutral-600">
            We couldn’t find this giving link. It may have been mistyped. You can always give directly instead.
          </p>
          <Link
            href="/donate"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Give now
          </Link>
        </div>
      </Shell>
    )
  }

  if (result.state === 'not_pending') {
    return (
      <Shell>
        <div className="text-center">
          <Heart className="mx-auto h-8 w-8 text-orange-400" />
          <h1 className="mt-3 text-xl font-bold text-neutral-900">You’re all set 🎉</h1>
          <p className="mt-2 text-sm text-neutral-600">
            This giving has already been re-confirmed — thank you. You can manage it any time from your account.
          </p>
          <Link
            href="/donor"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Go to my portal
          </Link>
        </div>
      </Shell>
    )
  }

  if (result.state === 'expired') {
    return (
      <Shell>
        <div className="text-center">
          <Heart className="mx-auto h-8 w-8 text-orange-400" />
          <h1 className="mt-3 text-xl font-bold text-neutral-900">This link has expired</h1>
          <p className="mt-2 text-sm text-neutral-600">
            No trouble — please give directly and your support will pick right back up, or contact us for a fresh link.
          </p>
          <Link
            href="/donate"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Give now
          </Link>
        </div>
      </Shell>
    )
  }

  const intent = result.intent

  const fund = await prisma.fund.findUnique({
    where: { slug: intent.fundSlug },
    select: { name: true, isActive: true, depositAccount: true },
  })
  if (!fund || !fund.isActive) {
    return (
      <Shell>
        <div className="text-center">
          <Heart className="mx-auto h-8 w-8 text-orange-400" />
          <h1 className="mt-3 text-xl font-bold text-neutral-900">We can’t load this right now</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Please contact us and we’ll get your giving moved across.
          </p>
        </div>
      </Shell>
    )
  }

  const accountKey = resolveAccount(fund.depositAccount)
  const frequency = isMigrationFrequency(intent.frequency) ? intent.frequency : 'monthly'
  const firstName = intent.donorName?.trim().split(/\s+/)[0] || 'there'

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          We’ve moved to a new home for managing giving. To keep your support going, just re-enter your card below —
          everything else is already filled in. It takes about a minute.
        </p>
      </div>

      <ResumeGivingForm
        migrationIntentId={intent.id}
        fundSlug={intent.fundSlug}
        fundName={fund.name}
        accountKey={accountKey}
        initialName={intent.donorName ?? ''}
        initialEmail={intent.email}
        initialCompany={intent.donorCompany ?? ''}
        initialAmount={intent.amountCents / 100}
        initialFrequency={frequency}
      />
    </Shell>
  )
}
