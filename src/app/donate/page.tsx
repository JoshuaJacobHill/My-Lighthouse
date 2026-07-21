import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { DonateForm } from './DonateForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Donate — Lighthouse Care',
  description: 'Support families doing it tough across South East Queensland.',
}

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ fund?: string; cancelled?: string }>
}) {
  // Public-facing, so it stays behind the feature flag until launch.
  if (!isDonorPortalEnabled()) notFound()

  const { fund: fundSlug, cancelled } = await searchParams

  // Use the requested fund, or fall back to the first active fund.
  const fund = fundSlug
    ? await prisma.fund.findFirst({
        where: { slug: fundSlug, isActive: true },
        select: { name: true, slug: true, description: true },
      })
    : await prisma.fund.findFirst({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { name: true, slug: true, description: true },
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
          <h1 className="text-2xl font-bold text-gray-900">Donate to {fund.name}</h1>
          <p className="mt-2 text-gray-500">
            {fund.description ??
              'Your gift helps families doing it tough across South East Queensland.'}
          </p>
        </div>

        {cancelled && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            No payment was made — your donation was cancelled. You’re welcome to try again below.
          </div>
        )}

        <DonateForm fundSlug={fund.slug} fundName={fund.name} />

        <p className="mt-6 text-center text-xs text-gray-400">
          Payments are processed securely by Stripe. Lighthouse Care never sees your card details.
        </p>
      </div>
    </div>
  )
}
