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
