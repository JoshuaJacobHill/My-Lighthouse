'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { getStripe, isStripeConfigured, toCents } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'
import { createOrderWithTickets, TicketError, type Selection } from '@/lib/tickets'
import { sendTicketConfirmationEmailForOrder } from '@/lib/event-emails'

interface RegisterResult {
  success: boolean
  error?: string
  url?: string // paid: Stripe checkout URL
  redirectTo?: string // free: confirmation page
}

const schema = z.object({
  eventId: z.string().min(1),
  purchaserName: z.string().trim().min(1, 'Please enter your name').max(120),
  purchaserEmail: z.email('Please enter a valid email address'),
  selections: z
    .array(z.object({ ticketTypeId: z.string().min(1), quantity: z.coerce.number().int().min(0).max(50) }))
    .min(1),
})

export type RegisterInput = z.input<typeof schema>

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function registerForEventAction(input: RegisterInput): Promise<RegisterResult> {
  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`event:${ip}`, 15, 60_000).ok) {
    return { success: false, error: 'Too many attempts — please wait a moment and try again.' }
  }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { eventId, purchaserName, purchaserEmail } = parsed.data
  const selections: Selection[] = parsed.data.selections.filter((s) => s.quantity > 0)
  if (selections.length === 0) {
    return { success: false, error: 'Please choose at least one ticket.' }
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      ticketTypes: { select: { id: true, name: true, price: true } },
    },
  })
  if (!event || !event.isPublished) {
    return { success: false, error: 'This event isn’t available right now.' }
  }

  const typeMap = new Map(event.ticketTypes.map((t) => [t.id, t]))
  let total = 0
  for (const s of selections) {
    const tt = typeMap.get(s.ticketTypeId)
    if (!tt) return { success: false, error: 'One of the selected tickets is no longer available.' }
    total += Number(tt.price) * s.quantity
  }

  // ── Free / RSVP: confirm immediately, no payment ──
  if (total === 0) {
    try {
      const { orderId } = await createOrderWithTickets({
        eventId,
        selections,
        purchaserName,
        purchaserEmail,
        amountTotal: 0,
        provider: 'FREE',
      })
      try {
        await sendTicketConfirmationEmailForOrder(orderId)
      } catch (err) {
        console.error('ticket confirmation email failed', err)
      }
      return { success: true, redirectTo: `/events/${event.slug}/registered?order=${orderId}` }
    } catch (err) {
      if (err instanceof TicketError) return { success: false, error: err.message }
      console.error('free registration failed', err)
      return { success: false, error: 'Could not complete your registration. Please try again.' }
    }
  }

  // ── Paid: hand off to Stripe Checkout; tickets created by the webhook ──
  if (!isStripeConfigured()) {
    return { success: false, error: 'Ticketing isn’t configured yet. Please try again soon.' }
  }

  try {
    const base = appUrl()
    const line_items = selections.map((s) => {
      const tt = typeMap.get(s.ticketTypeId)!
      return {
        quantity: s.quantity,
        price_data: {
          currency: 'aud',
          unit_amount: toCents(Number(tt.price)),
          product_data: { name: `${event.title} — ${tt.name}` },
        },
      }
    })
    // Compact selection encoding for the webhook (metadata values are size-limited).
    const encoded = JSON.stringify(selections.map((s) => ({ t: s.ticketTypeId, q: s.quantity })))
    const metadata = { kind: 'event_tickets', eventId, purchaserName, selections: encoded }

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: purchaserEmail,
      line_items,
      metadata,
      payment_intent_data: { description: `Tickets — ${event.title}`, metadata },
      success_url: `${base}/events/${event.slug}/registered?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/events/${event.slug}?cancelled=1`,
    })
    if (!session.url) return { success: false, error: 'Could not start checkout. Please try again.' }
    return { success: true, url: session.url }
  } catch (err) {
    console.error('paid registration failed', err)
    return { success: false, error: 'Could not start checkout. Please try again.' }
  }
}
