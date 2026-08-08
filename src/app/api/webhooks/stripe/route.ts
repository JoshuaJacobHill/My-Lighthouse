import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { configuredWebhookSecrets, getStripeFor } from '@/lib/stripe-accounts'
import { sendDonationReceiptEmail, sendAccountSetupEmail } from '@/lib/donation-emails'
import { createAccountSetupToken } from '@/lib/account-setup'
import { createOrderWithTickets, type Selection } from '@/lib/tickets'
import { sendTicketConfirmationEmailForOrder } from '@/lib/event-emails'

// Never cached; must read the raw body for signature verification.
export const dynamic = 'force-dynamic'

// ─── POST /api/webhooks/stripe ────────────────────────────────────────────────
//
// The single pipeline for money in (donor portal — plan §4/§8). Stripe calls
// this on payment events. We verify the signature, store every event for audit
// + idempotency (WebhookEvent.providerEventId is unique), then record the gift
// and match it to an account by verified email.

export async function POST(req: NextRequest) {
  const secrets = configuredWebhookSecrets()
  if (secrets.length === 0) {
    console.error('No Stripe webhook signing secret is configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await req.text()

  // The event may come from any of our accounts (Care / Church) — verify against
  // each configured signing secret and keep the one that validates.
  const verifier = getStripeFor(secrets[0].key)
  let event: Stripe.Event | null = null
  let matchedAccount = secrets[0].key
  for (const { key, secret } of secrets) {
    try {
      event = verifier.webhooks.constructEvent(rawBody, signature, secret)
      matchedAccount = key
      break
    } catch {
      // try the next account's secret
    }
  }
  if (!event) {
    console.error('Stripe signature verification failed for all configured accounts')
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
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.kind === 'event_tickets') {
        await recordTicketOrder(session)
      } else {
        await recordDonation(session)
      }
    } else if (event.type === 'payment_intent.succeeded') {
      // On-page (Payment Element) donations arrive as PaymentIntents, not
      // Checkout Sessions. Only act on our donation intents — ticket/checkout
      // PaymentIntents carry no `kind` and are recorded via the session event.
      const intent = event.data.object as Stripe.PaymentIntent
      if (intent.metadata?.kind === 'donation') {
        await recordDonationFromIntent(intent)
      }
    } else if (event.type === 'invoice.payment_succeeded') {
      // Recurring gifts: one invoice per cycle (first + renewals).
      const invoice = event.data.object as Stripe.Invoice
      await recordRecurringDonationFromInvoice(invoice, matchedAccount)
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

  await finalizeDonation({
    paymentIntentId,
    donorEmail: session.customer_details?.email ?? session.customer_email ?? '',
    donorName: meta.donorName || session.customer_details?.name || null,
    amount: (session.amount_total ?? 0) / 100,
    currency: (session.currency ?? 'aud').toUpperCase(),
    meta,
  })
}

async function recordDonationFromIntent(intent: Stripe.PaymentIntent): Promise<void> {
  const meta = intent.metadata ?? {}
  if (meta.kind !== 'donation') return

  await finalizeDonation({
    paymentIntentId: intent.id,
    donorEmail: intent.receipt_email || meta.donorEmail || '',
    donorName: meta.donorName || null,
    amount: (intent.amount_received ?? intent.amount ?? 0) / 100,
    currency: (intent.currency ?? 'aud').toUpperCase(),
    meta,
  })
}

async function recordRecurringDonationFromInvoice(
  invoice: Stripe.Invoice,
  accountKey: 'CARE' | 'CHURCH'
): Promise<void> {
  // The webhook delivers the endpoint's API version (2020-03-02), where these
  // fields sit at the top level — but the SDK types target a newer version, so
  // read them through a narrow cast.
  const inv = invoice as unknown as {
    subscription?: string | { id?: string } | null
    payment_intent?: string | { id?: string } | null
  }

  const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id
  if (!subId) return

  // The subscription carries our metadata (set at checkout). Retrieve it on the
  // account that signed this event so it works across Stripe API versions.
  let meta: Record<string, string> = {}
  try {
    const sub = await getStripeFor(accountKey).subscriptions.retrieve(subId)
    meta = (sub.metadata ?? {}) as Record<string, string>
  } catch {
    return
  }
  if (meta.kind !== 'donation') return
  // Carry the subscription id through so a migration intent can record it.
  meta.subscriptionId = subId

  const paymentIntentId =
    typeof inv.payment_intent === 'string'
      ? inv.payment_intent
      : inv.payment_intent?.id ?? invoice.id
  if (!paymentIntentId) return

  await finalizeDonation({
    paymentIntentId,
    donorEmail: invoice.customer_email || meta.donorEmail || '',
    donorName: meta.donorName || null,
    amount: (invoice.amount_paid ?? 0) / 100,
    currency: (invoice.currency ?? 'aud').toUpperCase(),
    meta,
    isRecurring: true,
  })
}

/**
 * Record a completed gift and send the receipt — shared by the Checkout-session
 * path (event tickets legacy / hosted checkout), the on-page PaymentIntent path,
 * and recurring invoices. Idempotent on providerTransactionId, so a retry or a
 * duplicate event is safe.
 */
async function finalizeDonation(params: {
  paymentIntentId: string
  donorEmail: string
  donorName: string | null
  amount: number
  currency: string
  meta: Record<string, string>
  isRecurring?: boolean
}): Promise<void> {
  const { paymentIntentId, donorEmail, donorName, amount, currency, meta, isRecurring } = params
  if (!paymentIntentId || !donorEmail) return

  // Idempotent on the gift itself: providerTransactionId is unique.
  const already = await prisma.donation.findUnique({
    where: { providerTransactionId: paymentIntentId },
    select: { id: true },
  })
  if (already) return

  // Match to an account only when that email is verified (plan §8).
  const user = await prisma.user.findFirst({
    where: { email: { equals: donorEmail, mode: 'insensitive' }, emailVerified: { not: null } },
    select: { id: true },
  })

  const fundId = meta.fundId || null
  const fundraiserId = meta.fundraiserId || null

  const donation = await prisma.donation.create({
    data: {
      userId: user?.id ?? null,
      donorEmail,
      donorName,
      donorCompany: meta.donorCompany || null,
      message: meta.message || null,
      amount,
      currency,
      provider: 'STRIPE',
      providerTransactionId: paymentIntentId,
      fundId,
      fundraiserId,
      isRecurring: isRecurring ?? false,
      isTithe: meta.isTithe === 'true',
      frequency: meta.frequency
        ? meta.frequency.charAt(0).toUpperCase() + meta.frequency.slice(1)
        : isRecurring
          ? null
          : 'One-off',
      source: fundraiserId ? 'FUNDRAISER' : 'DONATE_PAGE',
      migratedFrom: meta.migratedFrom || null,
      taxReceiptEligible: true,
    },
    select: { id: true },
  })

  // If this gift re-confirmed a migrated recurring donor, close out the intent
  // so we don't email them again or create a second subscription.
  if (meta.migrationIntentId) {
    try {
      await prisma.migrationIntent.updateMany({
        where: { id: meta.migrationIntentId, status: 'PENDING' },
        data: { status: 'COMPLETED', completedAt: new Date(), subscriptionId: meta.subscriptionId || null },
      })
    } catch (err) {
      console.error('Could not complete migration intent', err)
    }
  }

  // Best-effort receipt email — never let a send failure fail the webhook (the
  // gift is already safely recorded; retrying would only re-send).
  try {
    const fund = fundId
      ? await prisma.fund.findUnique({ where: { id: fundId }, select: { name: true } })
      : null
    await sendDonationReceiptEmail({
      to: donorEmail,
      name: donorName,
      amount,
      fundName: fund?.name ?? null,
      receiptNo: `LC-${donation.id.slice(-8).toUpperCase()}`,
    })
  } catch (err) {
    console.error('Donation receipt email failed', err)
  }

  // First-time donor with no account yet → invite them to set one up. Never
  // required to give; best-effort so it can't fail the webhook.
  try {
    if (!user) {
      const existing = await prisma.user.findFirst({
        where: { email: { equals: donorEmail, mode: 'insensitive' } },
        select: { id: true },
      })
      if (!existing) {
        const token = await createAccountSetupToken(donorEmail)
        await sendAccountSetupEmail({ to: donorEmail, name: donorName, token })
      }
    }
  } catch (err) {
    console.error('Account setup email failed', err)
  }
}

async function recordTicketOrder(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') return

  const meta = session.metadata ?? {}
  const eventId = meta.eventId
  if (!eventId) return

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
  if (!paymentIntentId) return

  // Decode the compact selection map set at checkout time.
  let selections: Selection[] = []
  try {
    const raw = JSON.parse(meta.selections ?? '[]') as { t: string; q: number }[]
    selections = raw.map((s) => ({ ticketTypeId: s.t, quantity: s.q }))
  } catch {
    console.error('Could not parse ticket selections from webhook metadata')
    return
  }
  if (selections.length === 0) return

  const purchaserEmail = session.customer_details?.email ?? session.customer_email ?? ''
  if (!purchaserEmail) return
  const purchaserName = meta.purchaserName || session.customer_details?.name || 'Guest'
  const amountTotal = (session.amount_total ?? 0) / 100

  // createOrderWithTickets is idempotent on providerTransactionId and enforces
  // capacity, so a retry (or a race with the buyer's return) is safe.
  const { orderId } = await createOrderWithTickets({
    eventId,
    selections,
    purchaserName,
    purchaserEmail,
    amountTotal,
    provider: 'STRIPE',
    providerTransactionId: paymentIntentId,
  })

  try {
    await sendTicketConfirmationEmailForOrder(orderId)
  } catch (err) {
    console.error('Ticket confirmation email failed', err)
  }
}
