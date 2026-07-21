import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// Never cached; must read the raw body for signature verification.
export const dynamic = 'force-dynamic'

// ─── POST /api/webhooks/stripe ────────────────────────────────────────────────
//
// The single pipeline for money in (donor portal — plan §4/§8). Stripe calls
// this on payment events. We verify the signature, store every event for audit
// + idempotency (WebhookEvent.providerEventId is unique), then record the gift
// and match it to an account by verified email.

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error('Stripe signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency: if we've already fully processed this event, ack and stop.
  const seen = await prisma.webhookEvent.findUnique({
    where: { providerEventId: event.id },
    select: { processedAt: true },
  })
  if (seen?.processedAt) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Record the event (create on first sight; safe to re-run).
  await prisma.webhookEvent.upsert({
    where: { providerEventId: event.id },
    create: {
      provider: 'STRIPE',
      eventType: event.type,
      providerEventId: event.id,
      payload: event as unknown as Prisma.InputJsonValue,
    },
    update: {},
  })

  try {
    if (event.type === 'checkout.session.completed') {
      await recordDonation(event.data.object as Stripe.Checkout.Session)
    }
    await prisma.webhookEvent.update({
      where: { providerEventId: event.id },
      data: { processedAt: new Date() },
    })
  } catch (err) {
    console.error('Webhook processing failed', event.type, err)
    await prisma.webhookEvent.update({
      where: { providerEventId: event.id },
      data: { error: err instanceof Error ? err.message : String(err) },
    })
    // 500 tells Stripe to retry later.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function recordDonation(session: Stripe.Checkout.Session): Promise<void> {
  // Only record actually-paid sessions.
  if (session.payment_status !== 'paid') return

  const meta = session.metadata ?? {}
  if (meta.kind !== 'donation') return

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
  if (!paymentIntentId) return

  // Idempotent on the gift itself: providerTransactionId is unique.
  const already = await prisma.donation.findUnique({
    where: { providerTransactionId: paymentIntentId },
    select: { id: true },
  })
  if (already) return

  const donorEmail =
    session.customer_details?.email ?? session.customer_email ?? ''
  if (!donorEmail) return

  const amount = (session.amount_total ?? 0) / 100
  const currency = (session.currency ?? 'aud').toUpperCase()

  // Match to an account only when that email is verified (plan §8).
  const user = await prisma.user.findFirst({
    where: { email: { equals: donorEmail, mode: 'insensitive' }, emailVerified: { not: null } },
    select: { id: true },
  })

  await prisma.donation.create({
    data: {
      userId: user?.id ?? null,
      donorEmail,
      donorName: meta.donorName || session.customer_details?.name || null,
      amount,
      currency,
      provider: 'STRIPE',
      providerTransactionId: paymentIntentId,
      fundId: meta.fundId || null,
      source: 'DONATE_PAGE',
      taxReceiptEligible: true,
    },
  })
}
