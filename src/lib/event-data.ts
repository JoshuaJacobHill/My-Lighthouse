import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'

/**
 * Cached reads for the public event page.
 *
 * The database lives in Tokyo while our functions run in Sydney, so each query
 * costs ~140ms of round-trip. These reads are identical for every visitor, so
 * they're cached and tagged; admin edits bust the tag immediately via
 * revalidateTag('events') rather than waiting for the window to lapse.
 *
 * Deliberately NOT cached: ticket availability (stale counts could oversell an
 * event) and anything derived from the viewer's session.
 */
export const EVENTS_TAG = 'events'

export const getCachedEvent = unstable_cache(
  async (slug: string) =>
    prisma.event.findFirst({
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
    }),
  ['public-event-by-slug'],
  { revalidate: 300, tags: [EVENTS_TAG] }
)

export const getCachedEventSponsors = unstable_cache(
  async (eventId: string) =>
    prisma.eventSponsor.findMany({
      where: { eventId, paid: true },
      orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, businessName: true, logoUrl: true, websiteUrl: true, tier: true },
    }),
  ['public-event-sponsors'],
  { revalidate: 300, tags: [EVENTS_TAG] }
)

export const getCachedEventVolunteerCount = unstable_cache(
  async (eventId: string) => prisma.eventVolunteer.count({ where: { eventId } }),
  ['public-event-volunteer-count'],
  { revalidate: 60, tags: [EVENTS_TAG] }
)
