import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, MapPin, Heart, ArrowRight, ImageIcon } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isDonorPortalEnabled } from '@/lib/features'
import { getEventAvailability } from '@/lib/tickets'
import { formatDateTime } from '@/lib/utils'
import { RegistrationForm, type TicketTypeOption } from './RegistrationForm'
import { EventVolunteerSignup } from '@/components/events/EventVolunteerSignup'
import { Markdown } from '@/components/ui/Markdown'

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
      imageUrl: true,
      venue: true,
      startsAt: true,
      capacity: true,
      churchOnly: true,
      allowVolunteers: true,
      volunteerCapacity: true,
      allowDonations: true,
      allowSponsors: true,
      fund: { select: { slug: true, name: true } },
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

  // Optional sections (Good Food Festival etc.).
  const [volunteerCount, sponsors, me] = await Promise.all([
    event.allowVolunteers ? prisma.eventVolunteer.count({ where: { eventId: event.id } }) : Promise.resolve(0),
    event.allowSponsors
      ? prisma.eventSponsor.findMany({
          where: { eventId: event.id, paid: true },
          orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, businessName: true, logoUrl: true, tier: true },
        })
      : Promise.resolve([]),
    event.allowVolunteers
      ? getSession().then((s) =>
          s ? prisma.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } }) : null
        )
      : Promise.resolve(null),
  ])

  const canDonate = event.allowDonations && event.fund
  const sponsorHref = `/events/${slug}/sponsor`

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        {event.imageUrl && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.imageUrl} alt={event.title} className="aspect-[16/9] w-full object-cover" />
          </div>
        )}
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

        <Markdown source={event.description} className="mb-8 text-gray-700" />

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

        {/* Volunteer sign-up */}
        {event.allowVolunteers && (
          <div className="mt-6">
            <EventVolunteerSignup
              eventId={event.id}
              signedUp={volunteerCount}
              capacity={event.volunteerCapacity}
              initialName={me?.name ?? undefined}
              initialEmail={me?.email ?? undefined}
            />
          </div>
        )}

        {/* Donate to the event */}
        {canDonate && event.fund && (
          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                <Heart className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Support {event.title}</h2>
                <p className="text-sm text-gray-500">Chip in to help make this event happen.</p>
              </div>
            </div>
            <Link
              href={`/donate?fund=${event.fund.slug}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Donate <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Sponsors */}
        {event.allowSponsors && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Sponsor this event</h2>
                <p className="text-sm text-gray-500">
                  Back the event as a Bronze, Silver or Gold sponsor — your logo appears here.
                </p>
              </div>
              <Link
                href={sponsorHref}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Become a sponsor <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {sponsors.length > 0 && (
              <>
                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">Our sponsors</p>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {sponsors.map((s) => (
                    <div
                      key={s.id}
                      className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white p-3"
                      title={`${s.businessName} · ${s.tier.toLowerCase()} sponsor`}
                    >
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt={s.businessName} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <ImageIcon className="h-6 w-6" />
                          <span className="mt-1 text-xs">{s.businessName}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Registration by Lighthouse Care. Paid tickets are processed securely by Stripe.
        </p>
      </div>
    </div>
  )
}
