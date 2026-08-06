'use server'

import type Stripe from 'stripe'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isStripeConfigured, toCents } from '@/lib/stripe'
import { getStripeFor, resolveAccount } from '@/lib/stripe-accounts'
import { ensureStripeCustomer, createPaymentCustomerSession } from '@/lib/stripe-customer'

const SUB_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion

const FREQ = {
  weekly: { interval: 'week' as const, interval_count: 1, label: 'Weekly' },
  fortnightly: { interval: 'week' as const, interval_count: 2, label: 'Fortnightly' },
  monthly: { interval: 'month' as const, interval_count: 1, label: 'Monthly' },
}

type Frequency = 'once' | 'weekly' | 'fortnightly' | 'monthly'

interface StartResult {
  success: boolean
  error?: string
  clientSecret?: string
  customerSessionClientSecret?: string | null
  accountKey?: 'CARE' | 'CHURCH'
}

// Fund all give-again gifts support (fast flow defaults to Lighthouse Care).
const GIVE_AGAIN_FUND_SLUG = 'lighthouse-care'

/**
 * Start the fast "give again" payment for a logged-in donor. Intent-first (we
 * create the PaymentIntent / subscription up front) so the Payment Element can
 * render the donor's saved cards, a save option, and Apple/Google Pay, and
 * confirm cleanly. Card details never touch us.
 */
export async function startGiveAgainPaymentAction(input: {
  amount: number
  frequency: Frequency
}): Promise<StartResult> {
  if (!isStripeConfigured()) {
    return { success: false, error: 'Donations aren’t configured yet. Please try again soon.' }
  }

  const session = await getSession()
  if (!session) return { success: false, error: 'Please log in to give.' }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  })
  if (!user) return { success: false, error: 'Please log in to give.' }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount < 2) {
    return { success: false, error: 'Minimum gift is $2.' }
  }
  const frequency = input.frequency
  const recurring = frequency !== 'once'
  if (recurring && !(frequency in FREQ)) {
    return { success: false, error: 'Please choose a valid frequency.' }
  }

  const fund = await prisma.fund.findUnique({
    where: { slug: GIVE_AGAIN_FUND_SLUG },
    select: { id: true, name: true, slug: true, isActive: true, depositAccount: true },
  })
  if (!fund || !fund.isActive) {
    return { success: false, error: 'Giving isn’t available right now.' }
  }
  const accountKey = resolveAccount(fund.depositAccount)
  const stripe = getStripeFor(accountKey)

  const meta: Record<string, string> = {
    kind: 'donation',
    fundId: fund.id,
    fundSlug: fund.slug,
    donorName: user.name ?? '',
    donorEmail: user.email,
    account: accountKey,
    source: 'DONATE_PAGE',
  }

  try {
    // Reusable customer → save card on file + show saved cards next time.
    const customerId = await ensureStripeCustomer({
      userId: session.userId,
      email: user.email,
      name: user.name,
      account: accountKey,
    })
    const customerSessionClientSecret = await createPaymentCustomerSession(accountKey, customerId)

    if (!recurring) {
      const intent = await stripe.paymentIntents.create(
        {
          amount: toCents(amount),
          currency: 'aud',
          customer: customerId,
          setup_future_usage: 'off_session', // save the card for faster giving next time
          receipt_email: user.email,
          description: `Donation — ${fund.name}`,
          automatic_payment_methods: { enabled: true },
          metadata: meta,
        },
        { apiVersion: SUB_API_VERSION }
      )
      if (!intent.client_secret) {
        return { success: false, error: 'Could not start payment. Please try again.' }
      }
      return { success: true, clientSecret: intent.client_secret, customerSessionClientSecret, accountKey }
    }

    // Recurring — subscription on the reusable customer.
    const freq = FREQ[frequency as 'weekly' | 'fortnightly' | 'monthly']
    const subMeta = { ...meta, isRecurring: 'true', frequency }
    const price = await stripe.prices.create(
      {
        currency: 'aud',
        unit_amount: toCents(amount),
        recurring: { interval: freq.interval, interval_count: freq.interval_count },
        product_data: { name: `${freq.label} donation — ${fund.name}` },
      },
      { apiVersion: SUB_API_VERSION }
    )
    const sub = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: subMeta,
      },
      { apiVersion: SUB_API_VERSION }
    )
    const inv = sub.latest_invoice as unknown as {
      payment_intent?: { client_secret?: string | null } | null
    } | null
    const clientSecret = inv?.payment_intent?.client_secret ?? null
    if (!clientSecret) {
      return { success: false, error: 'Could not start recurring payment. Please try again.' }
    }
    return { success: true, clientSecret, customerSessionClientSecret, accountKey }
  } catch (err) {
    console.error('startGiveAgainPaymentAction failed', err)
    return { success: false, error: 'Could not start payment. Please try again.' }
  }
}
