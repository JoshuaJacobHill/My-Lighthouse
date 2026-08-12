import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { EventForm, type EventFormValues } from '@/components/admin/EventForm'
import { EventSponsorsManager } from '@/components/admin/EventSponsorsManager'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Edit event | Lighthouse Care Admin' }

// Stored UTC → Brisbane (UTC+10) wall-clock for a datetime-local input.
function toDateTimeLocal(date: Date | null): string {
  return date ? new Date(date.getTime() + 10 * 60 * 60 * 1000).toISOString().slice(0, 16) : ''
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [event, funds] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: {
        ticketTypes: { orderBy: { sortOrder: 'asc' } },
        sponsors: {
          orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, businessName: true, tier: true, amount: true, logoUrl: true, websiteUrl: true, paid: true },
        },
      },
    }),
    prisma.fund.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
  ])

  if (!event) notFound()

  const values: EventFormValues = {
    id: event.id,
    title: event.title,
    slug: event.slug,
    description: event.description,
    venue: event.venue ?? '',
    startsAt: toDateTimeLocal(event.startsAt),
    endsAt: toDateTimeLocal(event.endsAt),
    capacity: event.capacity != null ? String(event.capacity) : '',
    fundId: event.fundId ?? '',
    isPublished: event.isPublished,
    churchOnly: event.churchOnly,
    imageUrl: event.imageUrl ?? '',
    allowVolunteers: event.allowVolunteers,
    volunteerCapacity: event.volunteerCapacity != null ? String(event.volunteerCapacity) : '',
    allowDonations: event.allowDonations,
    allowSponsors: event.allowSponsors,
    ticketTypes: event.ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price.toString(),
      quantityAvailable: t.quantityAvailable != null ? String(t.quantityAvailable) : '',
      maxPerOrder: t.maxPerOrder != null ? String(t.maxPerOrder) : '',
    })),
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit event</h1>
        <p className="mt-0.5 text-sm text-gray-500">{event.title}</p>
      </div>
      <EventForm event={values} funds={funds} />

      <EventSponsorsManager
        eventId={event.id}
        sponsors={event.sponsors.map((s) => ({
          id: s.id,
          businessName: s.businessName,
          tier: s.tier,
          amount: Number(s.amount),
          logoUrl: s.logoUrl,
          websiteUrl: s.websiteUrl,
          paid: s.paid,
        }))}
      />
    </div>
  )
}
