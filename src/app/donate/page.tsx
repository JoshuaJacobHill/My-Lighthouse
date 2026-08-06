import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isDonorPortalEnabled } from '@/lib/features'
import { resolveAccount } from '@/lib/stripe-accounts'
import { DonateForm } from './DonateForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Donate — Lighthouse Care',
  description: 'Support families doing it tough across South East Queensland.',
}

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ fund?: string; fundraiser?: string; cancelled?: string }>
}) {
  // Public-facing, so it stays behind the feature flag until launch.
  if (!isDonorPortalEnabled()) notFound()

  const { fund: fundSlug, fundraiser: fundraiserSlug, cancelled } = await searchParams

  // A gift to a fundraiser page uses that fundraiser's fund and is tagged to it.
  const fundraiser = fundraiserSlug
    ? await prisma.fundraiser.findFirst({
        where: { slug: fundraiserSlug, isActive: true },
        select: {
          id: true,
          title: true,
          fund: { select: { id: true, name: true, slug: true, description: true, depositAccount: true, goalAmount: true, showPublicProgress: true, presetAmounts: true, suggestedAmount: true, impactLabels: true, defaultFrequency: true } },
        },
      })
    : null

  // Use the fundraiser's fund, the requested fund, or the first active fund.
  const fund = fundraiser
    ? fundraiser.fund
    : fundSlug
      ? await prisma.fund.findFirst({
          where: { slug: fundSlug, isActive: true },
          select: { id: true, name: true, slug: true, description: true, depositAccount: true, goalAmount: true, showPublicProgress: true, presetAmounts: true, suggestedAmount: true, impactLabels: true, defaultFrequency: true },
        })
      : await prisma.fund.findFirst({
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, slug: true, description: true, depositAccount: true, goalAmount: true, showPublicProgress: true, presetAmounts: true, suggestedAmount: true, impactLabels: true, defaultFrequency: true },
        })

  if (!fund) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Donations aren’t open yet</h1>
        <p className="mt-2 text-gray-500">Please check back soon — thank you for your support.</p>
      </div>
    )
  }

  // Prefill donor details for signed-in users so they don't retype them.
  const session = await getSession()
  const currentUser = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true },
      })
    : null

  // GoFundMe-style progress — only when this fund opts into public progress.
  const goal = fund.goalAmount ? Number(fund.goalAmount) : null
  let progress: { raised: number; goal: number; pct: number; toGo: number } | null = null
  if (!fundraiser && fund.showPublicProgress && goal && goal > 0) {
    const { _sum } = await prisma.donation.aggregate({ where: { fundId: fund.id }, _sum: { amount: true } })
    const raised = Number(_sum.amount ?? 0)
    progress = { raised, goal, pct: Math.min(100, Math.round((raised / goal) * 100)), toGo: Math.max(0, goal - raised) }
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <a href="https://lighthousecare.org.au">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-inline-black.png" alt="Lighthouse Care" className="h-7 w-auto" />
          </a>
          <a href="/login" className="text-sm text-neutral-500">
            Already have an account? <span className="font-semibold text-orange-600">Sign in</span>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">
            {fundraiser ? `Donate to ${fundraiser.title}` : `Donate to ${fund.name}`}
          </h1>
          <p className="mt-2 text-neutral-500">
            {fundraiser
              ? 'Your gift supports this fundraiser for Lighthouse Care.'
              : 'Your gift helps families doing it tough across South East Queensland.'}
          </p>

          {progress && (
            <div className="mt-5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-orange-500" style={{ width: `${progress.pct}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold text-neutral-700">
                {aud0.format(progress.raised)} raised
                {progress.toGo > 0 && (
                  <span className="font-normal text-neutral-500"> · still {aud0.format(progress.toGo)} to go</span>
                )}
              </p>
            </div>
          )}

          {cancelled && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              No payment was made — your donation was cancelled. You’re welcome to try again below.
            </div>
          )}

          <div className="mt-6">
            <DonateForm
              fundSlug={fund.slug}
              fundName={fundraiser ? fundraiser.title : fund.name}
              fundraiserId={fundraiser?.id}
              accountKey={resolveAccount(fund.depositAccount)}
              initialName={currentUser?.name ?? undefined}
              initialEmail={currentUser?.email ?? undefined}
              presets={fund.presetAmounts}
              suggested={fund.suggestedAmount}
              impactLabels={(fund.impactLabels as Record<string, string> | null) ?? undefined}
              defaultFrequency={fund.defaultFrequency}
            />
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-sm text-center text-xs text-neutral-400">
          Lighthouse Care is an ACNC-registered charity. Payments are processed securely by Stripe —
          we never see your card details.
        </p>
      </div>
    </main>
  )
}

const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
