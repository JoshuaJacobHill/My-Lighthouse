import { notFound } from 'next/navigation'
import { CalendarDays, MapPin } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isDonorPortalEnabled } from '@/lib/features'
import { getEventAvailability } from '@/lib/tickets'
import { formatDateTime } from '@/lib/utils'
import { RegistrationForm, type TicketTypeOption } from './RegistrationForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await prisma.event.findFirst({
    where: { slug, isPublished: true },
    select: { title: true },
  })
  return { title: event ? `${event.title} — Lighthouse Care` : 'Event — Lighthouse Care' }
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ cancelled?: string }>
}) {
  if (!isDonorPortalEnabled()) notFound()

  const { slug } = await params
  const { cancelled } = await searchParams

  const event = await prisma.event.findFirst({
    where: { slug, isPublished: true },
    select: {
      id: true,
      title: true,
      description: true,
      venue: true,
      startsAt: true,
      capacity: true,
      churchOnly: true,
      ticketTypes: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, price: true, quantityAvailable: true, maxPerOrder: true },
      },
    },
  })
  if (!event) notFound()

  // Church-only events are hidden from everyone but church members.
  if (event.churchOnly) {
    const session = await getSession()
    const churchMember = session
      ? (await prisma.user.findUnique({ where: { id: session.userId }, select: { isChurchMember: true } }))
          ?.isChurchMember
      : false
    if (!churchMember) notFound()
  }

  const availability = await getEventAvailability(event.id)
  const overallRemaining =
    availability.capacity == null ? null : Math.max(0, availability.capacity - availability.totalSold)

  const options: TicketTypeOption[] = event.ticketTypes.map((t) => {
    const typeRemaining =
      t.quantityAvailable == null
        ? null
        : Math.max(0, t.quantityAvailable - (availability.soldByType[t.id] ?? 0))
    const caps = [t.maxPerOrder ?? 20, typeRemaining ?? 20, overallRemaining ?? 20]
    return {
      id: t.id,
      name: t.name,
      price: Number(t.price),
      remaining: typeRemaining,
      max: Math.max(0, Math.min(...caps)),
    }
  })

  const soldOut = overallRemaining === 0 || options.every((o) => o.max === 0)

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-orange-500" /> {formatDateTime(event.startsAt)}
            </span>
            {event.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-orange-500" /> {event.venue}
              </span>
            )}
          </div>
        </div>

        <p className="mb-8 whitespace-pre-line text-gray-700">{event.description}</p>

        {cancelled && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            No payment was made — your registration was cancelled. You&rsquo;re welcome to try again below.
          </div>
        )}

        {soldOut ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900">This event is fully booked</p>
            <p className="mt-1 text-sm text-gray-500">Thank you for your interest — please check back for future events.</p>
          </div>
        ) : (
          <RegistrationForm eventId={event.id} ticketTypes={options} />
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Registration by Lighthouse Care. Paid tickets are processed securely by Stripe.
        </p>
      </div>
    </div>
  )
}
