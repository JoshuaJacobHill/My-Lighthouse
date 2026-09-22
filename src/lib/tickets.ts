import crypto from 'crypto'
import prisma from '@/lib/prisma'

/** Thrown for expected registration problems (sold out, over limit, …). */
export class TicketError extends Error {}

export type Selection = { ticketTypeId: string; quantity: number }

/** Short, unique, human-readable check-in reference. */
export function generateReference(): string {
  return crypto.randomBytes(5).toString('hex').toUpperCase() // 10 chars
}

export type EventAvailability = {
  capacity: number | null
  totalSold: number
  soldByType: Record<string, number>
}

/** Confirmed tickets sold per type + overall, for an event. */
export async function getEventAvailability(eventId: string): Promise<EventAvailability> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { capacity: true },
  })
  const tickets = await prisma.ticket.findMany({
    where: { order: { eventId, status: 'CONFIRMED' } },
    select: { ticketTypeId: true },
  })
  const soldByType: Record<string, number> = {}
  for (const t of tickets) soldByType[t.ticketTypeId] = (soldByType[t.ticketTypeId] ?? 0) + 1
  return { capacity: event?.capacity ?? null, totalSold: tickets.length, soldByType }
}

/**
 * Create a confirmed ticket order and its individual tickets, enforcing
 * per-type limits, per-type availability and overall event capacity inside a
 * transaction. Idempotent on providerTransactionId (safe for webhook retries).
 * Matches the order to an account by verified email when possible.
 */
export async function createOrderWithTickets(params: {
  eventId: string
  selections: Selection[]
  purchaserName: string
  purchaserEmail: string
  amountTotal: number
  provider: string
  providerTransactionId?: string | null
  userId?: string | null
}): Promise<{ orderId: string }> {
  return prisma.$transaction(async (tx) => {
    if (params.providerTransactionId) {
      const existing = await tx.ticketOrder.findUnique({
        where: { providerTransactionId: params.providerTransactionId },
        select: { id: true },
      })
      if (existing) return { orderId: existing.id } // already processed
    }

    const event = await tx.event.findUnique({
      where: { id: params.eventId },
      select: {
        id: true,
        capacity: true,
        isPublished: true,
        ticketTypes: { select: { id: true, name: true, quantityAvailable: true, maxPerOrder: true } },
      },
    })
    if (!event) throw new TicketError('Event not found')

    const typeMap = new Map(event.ticketTypes.map((t) => [t.id, t]))
    const clean = params.selections.filter((s) => s.quantity > 0)
    if (clean.length === 0) throw new TicketError('Please choose at least one ticket.')

    const sold = await tx.ticket.findMany({
      where: { order: { eventId: params.eventId, status: 'CONFIRMED' } },
      select: { ticketTypeId: true },
    })
    const soldByType: Record<string, number> = {}
    for (const t of sold) soldByType[t.ticketTypeId] = (soldByType[t.ticketTypeId] ?? 0) + 1

    let totalRequested = 0
    for (const s of clean) {
      const tt = typeMap.get(s.ticketTypeId)
      if (!tt) throw new TicketError('One of the selected tickets is no longer available.')
      if (tt.maxPerOrder && s.quantity > tt.maxPerOrder) {
        throw new TicketError(`You can order at most ${tt.maxPerOrder} × ${tt.name}.`)
      }
      if (tt.quantityAvailable != null && (soldByType[s.ticketTypeId] ?? 0) + s.quantity > tt.quantityAvailable) {
        throw new TicketError(`Not enough "${tt.name}" tickets remaining.`)
      }
      totalRequested += s.quantity
    }
    if (event.capacity != null && sold.length + totalRequested > event.capacity) {
      throw new TicketError('This event is at capacity.')
    }

    let userId = params.userId ?? null
    if (!userId) {
      const user = await tx.user.findFirst({
        where: { email: { equals: params.purchaserEmail, mode: 'insensitive' }, emailVerified: { not: null } },
        select: { id: true },
      })
      userId = user?.id ?? null
    }

    const order = await tx.ticketOrder.create({
      data: {
        eventId: params.eventId,
        userId,
        purchaserName: params.purchaserName,
        purchaserEmail: params.purchaserEmail,
        amountTotal: params.amountTotal,
        provider: params.provider,
        providerTransactionId: params.providerTransactionId ?? null,
        status: 'CONFIRMED',
        tickets: {
          create: clean.flatMap((s) =>
            Array.from({ length: s.quantity }, () => ({
              ticketTypeId: s.ticketTypeId,
              reference: generateReference(),
            }))
          ),
        },
      },
      select: { id: true },
    })
    return { orderId: order.id }
  })
}

/**
 * The account a ticket order belongs to, found by **verified** email only.
 *
 * Typing an address proves nothing — that rule is the whole of `SECURITY.md`,
 * and attaching a purchase to an account on an unverified address would hand
 * somebody else's ticket history to whoever guessed the email. Covers the extra
 * addresses on an account too: a person who gave with a work address and buys a
 * ticket with a personal one is one person.
 */
export async function findTicketOwnerByEmail(email: string): Promise<string | null> {
  const clean = email.trim().toLowerCase()
  if (!clean) return null

  const direct = await prisma.user.findFirst({
    where: { email: { equals: clean, mode: 'insensitive' }, emailVerified: { not: null } },
    select: { id: true },
  })
  if (direct) return direct.id

  const extra = await prisma.userEmail.findFirst({
    where: { email: { equals: clean, mode: 'insensitive' }, verifiedAt: { not: null } },
    select: { userId: true },
  })
  return extra?.userId ?? null
}

/**
 * Attach orders bought before somebody had an account — or bought signed out.
 *
 * The ticket half of `claimDonationsForUser`, and for the same reason: history
 * should follow a person in when they prove they control the inbox, rather than
 * stranding it on an address. Verified addresses only, every one on the account.
 */
export async function claimTicketOrdersForUser(
  userId: string,
  email: string | null,
  emailVerified: Date | null
): Promise<number> {
  const extras = await prisma.userEmail.findMany({
    where: { userId, verifiedAt: { not: null } },
    select: { email: true },
  })
  const addresses = [...(email && emailVerified ? [email] : []), ...extras.map((e) => e.email)]
  if (addresses.length === 0) return 0

  const { count } = await prisma.ticketOrder.updateMany({
    where: {
      userId: null,
      OR: addresses.map((a) => ({ purchaserEmail: { equals: a, mode: 'insensitive' as const } })),
    },
    data: { userId },
  })
  return count
}
