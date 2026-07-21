import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Heart } from 'lucide-react'
import { isDonorPortalEnabled } from '@/lib/features'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Thank you — Lighthouse Care', robots: { index: false } }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export default async function DonateSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  if (!isDonorPortalEnabled()) notFound()

  const { session_id: sessionId } = await searchParams

  let amountLabel: string | null = null
  let donorName: string | null = null

  // Best-effort: show the gift amount. The gift is recorded by the webhook, not here.
  if (sessionId && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId)
      if (session.amount_total) amountLabel = aud.format(session.amount_total / 100)
      donorName = (session.metadata?.donorName as string) || null
    } catch {
      // Ignore — still show a thank-you.
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
          <Heart className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-gray-900">
          Thank you{donorName ? `, ${donorName}` : ''}.
        </h1>
        <p className="mt-3 text-gray-600">
          {amountLabel
            ? `Your gift of ${amountLabel} will help families doing it tough across South East Queensland.`
            : 'Your gift will help families doing it tough across South East Queensland.'}
        </p>
        <p className="mt-3 text-sm text-gray-500">
          A receipt is on its way to your inbox. From all of us at Lighthouse Care — thank you for
          standing with our community.
        </p>
        <Link
          href="/donate"
          className="mt-6 inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to donations
        </Link>
      </div>
    </div>
  )
}
