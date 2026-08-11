'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { eventSchema, type EventInput } from '@/lib/validations'

interface ActionResult {
  success: boolean
  error?: string
  eventId?: string
}

async function requireAdminSession(): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new Error('Insufficient permissions')
  }
  return { userId: session.userId, role: session.role }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || 'event'
  let candidate = root
  let n = 1
  for (;;) {
    const existing = await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === excludeId) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

// datetime-local strings are wall-clock with no zone; treat them as Brisbane
// (UTC+10, no daylight saving) so what staff type is what donors see.
function toEventDate(value: string | undefined): Date | null {
  if (!value) return null
  const withZone = value.length === 16 ? `${value}:00+10:00` : `${value}+10:00`
  const d = new Date(withZone)
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createEventAction(input: EventInput): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const parsed = eventSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid event details' }
  }
  const data = parsed.data

  const startsAt = toEventDate(data.startsAt)
  if (!startsAt) return { success: false, error: 'Start date and time is invalid' }

  try {
    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title))
    const event = await prisma.event.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        venue: data.venue ?? null,
        startsAt,
        endsAt: toEventDate(data.endsAt),
        capacity: data.capacity ?? null,
        fundId: data.fundId ?? null,
        isPublished: data.isPublished ?? false,
        churchOnly: data.churchOnly ?? false,
        imageUrl: data.imageUrl ?? null,
        allowVolunteers: data.allowVolunteers ?? false,
        volunteerCapacity: data.volunteerCapacity ?? null,
        allowDonations: data.allowDonations ?? false,
        allowSponsors: data.allowSponsors ?? false,
        ticketTypes: {
          create: data.ticketTypes.map((t, i) => ({
            name: t.name,
            price: t.price ?? 0,
            quantityAvailable: t.quantityAvailable ?? null,
            maxPerOrder: t.maxPerOrder ?? null,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    })
    return { success: true, eventId: event.id }
  } catch (err) {
    console.error('createEventAction failed', err)
    return { success: false, error: 'Could not create the event. Please try again.' }
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateEventAction(
  eventId: string,
  input: EventInput
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const parsed = eventSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid event details' }
  }
  const data = parsed.data

  const startsAt = toEventDate(data.startsAt)
  if (!startsAt) return { success: false, error: 'Start date and time is invalid' }

  try {
    const existing = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, ticketTypes: { select: { id: true, _count: { select: { tickets: true } } } } },
    })
    if (!existing) return { success: false, error: 'Event not found' }

    const slug = await uniqueSlug(data.slug ? slugify(data.slug) : slugify(data.title), eventId)
    const submittedIds = new Set(data.ticketTypes.filter((t) => t.id).map((t) => t.id!))

    // Remove ticket types the admin deleted — but only if none were sold.
    const toDelete = existing.ticketTypes
      .filter((t) => !submittedIds.has(t.id) && t._count.tickets === 0)
      .map((t) => t.id)

    await prisma.$transaction([
      prisma.event.update({
        where: { id: eventId },
        data: {
          title: data.title,
          slug,
          description: data.description,
          venue: data.venue ?? null,
          startsAt,
          endsAt: toEventDate(data.endsAt),
          capacity: data.capacity ?? null,
          fundId: data.fundId ?? null,
          isPublished: data.isPublished ?? false,
          churchOnly: data.churchOnly ?? false,
        imageUrl: data.imageUrl ?? null,
        allowVolunteers: data.allowVolunteers ?? false,
        volunteerCapacity: data.volunteerCapacity ?? null,
        allowDonations: data.allowDonations ?? false,
        allowSponsors: data.allowSponsors ?? false,
        },
      }),
      ...(toDelete.length
        ? [prisma.ticketType.deleteMany({ where: { id: { in: toDelete } } })]
        : []),
      ...data.ticketTypes.map((t, i) =>
        t.id
          ? prisma.ticketType.update({
              where: { id: t.id },
              data: {
                name: t.name,
                price: t.price ?? 0,
                quantityAvailable: t.quantityAvailable ?? null,
                maxPerOrder: t.maxPerOrder ?? null,
                sortOrder: i,
              },
            })
          : prisma.ticketType.create({
              data: {
                eventId,
                name: t.name,
                price: t.price ?? 0,
                quantityAvailable: t.quantityAvailable ?? null,
                maxPerOrder: t.maxPerOrder ?? null,
                sortOrder: i,
              },
            })
      ),
    ])

    return { success: true, eventId }
  } catch (err) {
    console.error('updateEventAction failed', err)
    return { success: false, error: 'Could not update the event. Please try again.' }
  }
}

// ─── Publish toggle ─────────────────────────────────────────────────────────

export async function toggleEventPublishedAction(
  eventId: string,
  isPublished: boolean
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    await prisma.event.update({ where: { id: eventId }, data: { isPublished } })
    return { success: true, eventId }
  } catch (err) {
    console.error('toggleEventPublishedAction failed', err)
    return { success: false, error: 'Could not update the event. Please try again.' }
  }
}

// ─── Offline sponsors (admin adds a business that sponsored offline) ──────────

export async function addOfflineSponsorAction(input: {
  eventId: string
  businessName: string
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  amount: number | string
  logoUrl?: string
  contactName?: string
  contactEmail?: string
}): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  const amount = Number(input.amount)
  if (!input.businessName?.trim()) return { success: false, error: 'Business name is required' }
  if (!['BRONZE', 'SILVER', 'GOLD'].includes(input.tier)) return { success: false, error: 'Invalid tier' }
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Amount must be a positive number' }

  const event = await prisma.event.findUnique({ where: { id: input.eventId }, select: { slug: true } })
  if (!event) return { success: false, error: 'Event not found' }

  await prisma.eventSponsor.create({
    data: {
      eventId: input.eventId,
      businessName: input.businessName.trim(),
      tier: input.tier,
      amount,
      logoUrl: input.logoUrl?.trim() || null,
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      paid: true,
    },
  })
  revalidatePath(`/events/${event.slug}`)
  revalidatePath(`/admin/events/${input.eventId}/attendees`)
  return { success: true }
}

export async function removeEventSponsorAction(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  const sp = await prisma.eventSponsor.findUnique({
    where: { id },
    select: { eventId: true, event: { select: { slug: true } } },
  })
  await prisma.eventSponsor.delete({ where: { id } }).catch(() => {})
  if (sp?.event?.slug) revalidatePath(`/events/${sp.event.slug}`)
  if (sp?.eventId) revalidatePath(`/admin/events/${sp.eventId}/attendees`)
  return { success: true }
}
