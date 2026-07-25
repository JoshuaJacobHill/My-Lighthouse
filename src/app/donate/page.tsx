import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
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
          fund: { select: { name: true, slug: true, description: true, depositAccount: true } },
        },
      })
    : null

  // Use the fundraiser's fund, the requested fund, or the first active fund.
  const fund = fundraiser
    ? fundraiser.fund
    : fundSlug
      ? await prisma.fund.findFirst({
          where: { slug: fundSlug, isActive: true },
          select: { name: true, slug: true, description: true, depositAccount: true },
        })
      : await prisma.fund.findFirst({
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { name: true, slug: true, description: true, depositAccount: true },
        })

  if (!fund) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Donations aren’t open yet</h1>
        <p className="mt-2 text-gray-500">Please check back soon — thank you for your support.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {fundraiser ? `Donate to ${fundraiser.title}` : `Donate to ${fund.name}`}
          </h1>
          <p className="mt-2 text-gray-500">
            {fundraiser
              ? 'Your gift supports this fundraiser for Lighthouse Care.'
              : (fund.description ??
                'Your gift helps families doing it tough across South East Queensland.')}
          </p>
        </div>

        {cancelled && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            No payment was made — your donation was cancelled. You’re welcome to try again below.
          </div>
        )}

        <DonateForm
          fundSlug={fund.slug}
          fundName={fundraiser ? fundraiser.title : fund.name}
          fundraiserId={fundraiser?.id}
          accountKey={resolveAccount(fund.depositAccount)}
        />

        <p className="mt-6 text-center text-xs text-gray-400">
          Payments are processed securely by Stripe. Lighthouse Care never sees your card details.
        </p>
      </div>
    </div>
  )
}
