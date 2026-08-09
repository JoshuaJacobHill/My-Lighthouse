import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isDonorPortalEnabled } from '@/lib/features'
import { resolveAccount } from '@/lib/stripe-accounts'
import { EventSponsorFlow } from '@/components/events/EventSponsorFlow'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Become a sponsor — Lighthouse Care' }

export default async function EventSponsorPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isDonorPortalEnabled()) notFound()
  const { slug } = await params

  const event = await prisma.event.findFirst({
    where: { slug, isPublished: true, allowSponsors: true },
    select: { id: true, slug: true, title: true, fund: { select: { depositAccount: true } } },
  })
  if (!event || !event.fund) notFound()

  const session = await getSession()
  const me = session
    ? await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } })
    : null

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href={`/events/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to {event.title}
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Sponsor {event.title}</h1>
        <p className="mt-2 text-gray-500">
          Choose a tier, set your amount, and upload your logo — it appears on the event page as soon as you sponsor.
        </p>

        <div className="mt-8">
          <EventSponsorFlow
            eventId={event.id}
            eventSlug={event.slug}
            accountKey={resolveAccount(event.fund.depositAccount)}
            initialName={me?.name ?? undefined}
            initialEmail={me?.email ?? undefined}
          />
        </div>

        <p className="mx-auto mt-6 max-w-sm text-center text-xs text-gray-400">
          Processed securely by Stripe. A receipt is emailed to you.
        </p>
      </div>
    </div>
  )
}
