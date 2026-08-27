import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, MapPin, Heart, ArrowRight, ImageIcon } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isDonorPortalEnabled } from '@/lib/features'
import { getEventAvailability } from '@/lib/tickets'
import { formatEventWhen } from '@/lib/utils'
import { RegistrationForm, type TicketTypeOption } from './RegistrationForm'
import { EventVolunteerSignup } from '@/components/events/EventVolunteerSignup'
import { Markdown } from '@/components/ui/Markdown'
import { SmartImage } from '@/components/ui/SmartImage'
import { EventSponsorStrip } from '@/components/events/EventSponsorStrip'
import { SPONSOR_TIER_ORDER, SPONSOR_TIER_HEADING } from '@/lib/sponsor-tiers'
import { PortalShell } from '@/components/layout/PortalShell'

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
      endsAt: true,
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

  // Who's viewing? Signed-in supporters keep the portal shell (nav) wrapped
  // around the event; anonymous visitors get the standalone public page.
  const session = await getSession()
  const viewer = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          name: true,
          email: true,
          isChurchMember: true,
          volunteerProfile: { select: { id: true } },
          _count: { select: { donations: true } },
        },
      })
    : null

  // Church-only events are hidden from everyone but church members.
  if (event.churchOnly && !viewer?.isChurchMember) notFound()

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
  const [volunteerCount, sponsors] = await Promise.all([
    event.allowVolunteers ? prisma.eventVolunteer.count({ where: { eventId: event.id } }) : Promise.resolve(0),
    event.allowSponsors
      ? prisma.eventSponsor.findMany({
          where: { eventId: event.id, paid: true },
          orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, businessName: true, logoUrl: true, websiteUrl: true, tier: true },
        })
      : Promise.resolve([]),
  ])

  const canDonate = event.allowDonations && event.fund
  const sponsorHref = `/events/${slug}/sponsor`

  const content = (
    <div className="mx-auto max-w-2xl">
      {event.imageUrl && (
          <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
            <SmartImage
              src={event.imageUrl}
              alt={event.title}
              fill
              priority
              sizes="(max-width: 672px) 100vw, 672px"
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{event.title}</h1>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-gray-900">{formatEventWhen(event.startsAt, event.endsAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <MapPin className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-gray-900">{event.venue || 'Location to be advised'}</p>
            </div>
          </div>
          <hr className="mt-6 border-gray-200" />
        </div>

        {event.allowSponsors && <EventSponsorStrip sponsors={sponsors} />}

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
              initialName={viewer?.name ?? undefined}
              initialEmail={viewer?.email ?? undefined}
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
            {sponsors.length > 0 && (
              <div className="mb-6 space-y-8">
                {SPONSOR_TIER_ORDER.map((tierKey) => {
                  const group = sponsors.filter((s) => s.tier === tierKey)
                  if (group.length === 0) return null
                  const isGold = tierKey === 'GOLD'
                  const box = isGold ? 'h-20 w-20' : 'h-14 w-14'
                  const nameText = isGold ? 'text-lg font-bold text-gray-900' : 'font-bold text-gray-900'
                  return (
                    <div key={tierKey}>
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {SPONSOR_TIER_HEADING[tierKey]}
                      </h2>
                      <div className="mt-4 space-y-4">
                        {group.map((s) => {
                          const inner = (
                            <>
                              <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black p-2`}>
                                {s.logoUrl ? (
                                  <SmartImage
                                    src={s.logoUrl}
                                    alt={s.businessName}
                                    width={isGold ? 160 : 112}
                                    height={isGold ? 160 : 112}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <ImageIcon className="h-6 w-6 text-gray-500" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className={nameText}>{s.businessName}</p>
                                {s.websiteUrl && (
                                  <span className="text-sm font-medium text-orange-600 group-hover:underline">
                                    Visit website →
                                  </span>
                                )}
                              </div>
                            </>
                          )
                          return s.websiteUrl ? (
                            <a
                              key={s.id}
                              href={s.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-4"
                            >
                              {inner}
                            </a>
                          ) : (
                            <div key={s.id} className="flex items-center gap-4">
                              {inner}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div
              className={
                'flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center' +
                (sponsors.length > 0 ? ' border-t border-gray-100 pt-6' : '')
              }
            >
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
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Registration by Lighthouse Care. Paid tickets are processed securely by Stripe.
        </p>
    </div>
  )

  // Signed-in supporters keep the portal navigation around the event.
  if (viewer) {
    return (
      <PortalShell
        userName={viewer.name ?? 'Friend'}
        isVolunteer={Boolean(viewer.volunteerProfile)}
        hasGiven={(viewer._count.donations ?? 0) > 0}
      >
        <div className="-m-4 min-h-full bg-gray-50 px-5 py-8 lg:-m-6 lg:px-8">{content}</div>
      </PortalShell>
    )
  }

  return <div className="min-h-screen bg-gray-50 px-6 py-12">{content}</div>
}
