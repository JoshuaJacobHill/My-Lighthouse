'use server'

import { z } from 'zod'
import type Stripe from 'stripe'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { isStripeConfigured, toCents } from '@/lib/stripe'
import { getStripeFor, resolveAccount } from '@/lib/stripe-accounts'
import { rateLimit } from '@/lib/rate-limit'

// Pin a modern API version for subscription calls — the account's default
// version is old and doesn't accept the modern subscription params (and shapes
// the invoice's payment intent differently). This version supports them and
// still exposes latest_invoice.payment_intent.
const SUB_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion

interface CheckoutResult {
  success: boolean
  error?: string
  url?: string
}

interface IntentResult {
  success: boolean
  error?: string
  clientSecret?: string
  accountKey?: 'CARE' | 'CHURCH'
}

const donateSchema = z.object({
  fundSlug: z.string().min(1),
  amount: z.coerce
    .number()
    .min(2, 'Minimum donation is $2')
    .max(100000, 'Please contact us directly for gifts over $100,000'),
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.email('Please enter a valid email address'),
  fundraiserId: z.string().optional(), // tag the gift to a fundraiser page
  message: z.string().trim().max(250).optional(), // optional public message
  company: z.string().trim().max(120).optional(), // optional company / organisation
  migrationIntentId: z.string().optional(), // set when re-confirming a migrated donor
  isTithe: z.boolean().optional(), // church tithe gift (kept separate from giving)
})

export type DonateInput = z.input<typeof donateSchema>

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

/**
 * Start a one-time donation: validate, create a Stripe Checkout Session for the
 * chosen fund, and hand back the hosted-checkout URL for the browser to open.
 * The gift is only recorded once Stripe confirms payment via the webhook — this
 * action never writes a Donation row itself.
 */
export async function createDonationCheckoutAction(
  input: DonateInput
): Promise<CheckoutResult> {
  if (!isStripeConfigured()) {
    return { success: false, error: 'Donations aren’t configured yet. Please try again soon.' }
  }

  // Rate limit by client IP — defence against flooding the checkout endpoint.
  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  const limit = rateLimit(`donate:${ip}`, 10, 60_000)
  if (!limit.ok) {
    return { success: false, error: 'Too many attempts — please wait a moment and try again.' }
  }

  const parsed = donateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { fundSlug, amount, name, email, fundraiserId, message, company } = parsed.data

  const fund = await prisma.fund.findUnique({
    where: { slug: fundSlug },
    select: { id: true, name: true, slug: true, isActive: true, depositAccount: true },
  })
  if (!fund || !fund.isActive) {
    return { success: false, error: 'That fund isn’t available right now.' }
  }
  // Which Stripe account this fund's gifts deposit to (falls back to CARE).
  const accountKey = resolveAccount(fund.depositAccount)

  // If this gift is for a fundraiser page, confirm it's live so we can tag it.
  let validFundraiserId: string | undefined
  if (fundraiserId) {
    const fr = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      select: { id: true, isActive: true },
    })
    if (fr?.isActive) validFundraiserId = fr.id
  }

  try {
    const base = appUrl()
    const meta: Record<string, string> = {
      kind: 'donation',
      fundId: fund.id,
      fundSlug: fund.slug,
      donorName: name,
      account: accountKey,
      source: validFundraiserId ? 'FUNDRAISER' : 'DONATE_PAGE',
    }
    if (validFundraiserId) meta.fundraiserId = validFundraiserId
    if (message) meta.message = message
    if (company) meta.donorCompany = company
    const cancelUrl = validFundraiserId
      ? `${base}/donate?fundraiser=${fundraiserId}&cancelled=1`
      : `${base}/donate?fund=${fund.slug}&cancelled=1`
    const session = await getStripeFor(accountKey).checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'aud',
            unit_amount: toCents(amount),
            product_data: {
              name: `Donation — ${fund.name}`,
              description: 'Thank you for supporting Lighthouse Care.',
            },
          },
        },
      ],
      // Everything the webhook needs to record the gift and tag it to a fund/fundraiser.
      metadata: meta,
      payment_intent_data: { description: `Donation — ${fund.name}`, metadata: meta },
      success_url: `${base}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    })

    if (!session.url) {
      return { success: false, error: 'Could not start checkout. Please try again.' }
    }
    return { success: true, url: session.url }
  } catch (err) {
    console.error('createDonationCheckoutAction failed', err)
    return { success: false, error: 'Could not start checkout. Please try again.' }
  }
}

/**
 * On-page (Payment Element) donation: validate, then create a PaymentIntent on
 * the fund's Stripe account and hand back its client secret so the browser can
 * confirm the card without leaving the page. Same as the hosted-checkout action,
 * the gift is only recorded once Stripe confirms via the `payment_intent.succeeded`
 * webhook — this action never writes a Donation row.
 */
export async function createDonationIntentAction(input: DonateInput): Promise<IntentResult> {
  if (!isStripeConfigured()) {
    return { success: false, error: 'Donations aren’t configured yet. Please try again soon.' }
  }

  // Rate limit by client IP — defence against flooding the payments endpoint.
  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  const limit = rateLimit(`donate-intent:${ip}`, 15, 60_000)
  if (!limit.ok) {
    return { success: false, error: 'Too many attempts — please wait a moment and try again.' }
  }

  const parsed = donateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { fundSlug, amount, name, email, fundraiserId, message, company } = parsed.data

  const fund = await prisma.fund.findUnique({
    where: { slug: fundSlug },
    select: { id: true, name: true, slug: true, isActive: true, depositAccount: true },
  })
  if (!fund || !fund.isActive) {
    return { success: false, error: 'That fund isn’t available right now.' }
  }
  const accountKey = resolveAccount(fund.depositAccount)

  // If this gift is for a fundraiser page, confirm it's live so we can tag it.
  let validFundraiserId: string | undefined
  if (fundraiserId) {
    const fr = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      select: { id: true, isActive: true },
    })
    if (fr?.isActive) validFundraiserId = fr.id
  }

  try {
    const meta: Record<string, string> = {
      kind: 'donation',
      fundId: fund.id,
      fundSlug: fund.slug,
      donorName: name,
      donorEmail: email,
      account: accountKey,
      source: validFundraiserId ? 'FUNDRAISER' : 'DONATE_PAGE',
    }
    if (validFundraiserId) meta.fundraiserId = validFundraiserId
    if (message) meta.message = message
    if (company) meta.donorCompany = company
    if (parsed.data.isTithe) meta.isTithe = 'true'

    const intent = await getStripeFor(accountKey).paymentIntents.create({
      amount: toCents(amount),
      currency: 'aud',
      receipt_email: email,
      description: `Donation — ${fund.name}`,
      automatic_payment_methods: { enabled: true },
      metadata: meta,
    })

    if (!intent.client_secret) {
      return { success: false, error: 'Could not start payment. Please try again.' }
    }
    return { success: true, clientSecret: intent.client_secret, accountKey }
  } catch (err) {
    console.error('createDonationIntentAction failed', err)
    return { success: false, error: 'Could not start payment. Please try again.' }
  }
}

// ─── Recurring donations (weekly / fortnightly / monthly) ─────────────────────

const FREQ = {
  weekly: { interval: 'week' as const, interval_count: 1, label: 'Weekly' },
  fortnightly: { interval: 'week' as const, interval_count: 2, label: 'Fortnightly' },
  monthly: { interval: 'month' as const, interval_count: 1, label: 'Monthly' },
}

const subscriptionSchema = donateSchema.extend({
  frequency: z.enum(['weekly', 'fortnightly', 'monthly']),
})
export type SubscriptionInput = z.input<typeof subscriptionSchema>

/**
 * Start a recurring gift. Creates a Stripe Checkout Session in subscription mode
 * on the fund's account and returns the hosted-checkout URL. Each successful
 * charge is recorded by the `invoice.payment_succeeded` webhook.
 */
export async function createDonationSubscriptionCheckoutAction(
  input: SubscriptionInput
): Promise<CheckoutResult> {
  if (!isStripeConfigured()) {
    return { success: false, error: 'Donations aren’t configured yet. Please try again soon.' }
  }

  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  const limit = rateLimit(`donate-sub:${ip}`, 10, 60_000)
  if (!limit.ok) {
    return { success: false, error: 'Too many attempts — please wait a moment and try again.' }
  }

  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { fundSlug, amount, name, email, fundraiserId, message, frequency, company } = parsed.data

  const fund = await prisma.fund.findUnique({
    where: { slug: fundSlug },
    select: { id: true, name: true, slug: true, isActive: true, depositAccount: true },
  })
  if (!fund || !fund.isActive) {
    return { success: false, error: 'That fund isn’t available right now.' }
  }
  const accountKey = resolveAccount(fund.depositAccount)

  let validFundraiserId: string | undefined
  if (fundraiserId) {
    const fr = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      select: { id: true, isActive: true },
    })
    if (fr?.isActive) validFundraiserId = fr.id
  }

  const freq = FREQ[frequency]

  try {
    const base = appUrl()
    const meta: Record<string, string> = {
      kind: 'donation',
      isRecurring: 'true',
      frequency,
      fundId: fund.id,
      fundSlug: fund.slug,
      donorName: name,
      donorEmail: email,
      account: accountKey,
      source: validFundraiserId ? 'FUNDRAISER' : 'DONATE_PAGE',
    }
    if (validFundraiserId) meta.fundraiserId = validFundraiserId
    if (message) meta.message = message
    if (company) meta.donorCompany = company

    const cancelUrl = validFundraiserId
      ? `${base}/donate?fundraiser=${fundraiserId}&cancelled=1`
      : `${base}/donate?fund=${fund.slug}&cancelled=1`

    const session = await getStripeFor(accountKey).checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'aud',
            unit_amount: toCents(amount),
            recurring: { interval: freq.interval, interval_count: freq.interval_count },
            product_data: { name: `${freq.label} donation — ${fund.name}` },
          },
        },
      ],
      subscription_data: { metadata: meta },
      metadata: meta,
      success_url: `${base}/donate/success?acct=${accountKey}`,
      cancel_url: cancelUrl,
    })

    if (!session.url) {
      return { success: false, error: 'Could not start checkout. Please try again.' }
    }
    return { success: true, url: session.url }
  } catch (err) {
    console.error('createDonationSubscriptionCheckoutAction failed', err)
    return { success: false, error: 'Could not start checkout. Please try again.' }
  }
}

/**
 * On-page recurring donation (Payment Element, no redirect). Creates a Stripe
 * subscription with an incomplete first invoice and returns that invoice's
 * PaymentIntent client secret, so the browser can confirm it inline exactly
 * like a one-off gift. The subscription carries our metadata; the recurring
 * charges (including this first one) are recorded by the invoice webhook.
 */
export async function createDonationSubscriptionIntentAction(
  input: SubscriptionInput
): Promise<IntentResult> {
  if (!isStripeConfigured()) {
    return { success: false, error: 'Donations aren’t configured yet. Please try again soon.' }
  }

  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  const limit = rateLimit(`donate-sub-intent:${ip}`, 15, 60_000)
  if (!limit.ok) {
    return { success: false, error: 'Too many attempts — please wait a moment and try again.' }
  }

  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { fundSlug, amount, name, email, fundraiserId, message, frequency, company } = parsed.data

  const fund = await prisma.fund.findUnique({
    where: { slug: fundSlug },
    select: { id: true, name: true, slug: true, isActive: true, depositAccount: true },
  })
  if (!fund || !fund.isActive) {
    return { success: false, error: 'That fund isn’t available right now.' }
  }
  const accountKey = resolveAccount(fund.depositAccount)

  let validFundraiserId: string | undefined
  if (fundraiserId) {
    const fr = await prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      select: { id: true, isActive: true },
    })
    if (fr?.isActive) validFundraiserId = fr.id
  }

  const freq = FREQ[frequency]

  try {
    const stripe = getStripeFor(accountKey)
    const meta: Record<string, string> = {
      kind: 'donation',
      isRecurring: 'true',
      frequency,
      fundId: fund.id,
      fundSlug: fund.slug,
      donorName: name,
      donorEmail: email,
      account: accountKey,
      source: validFundraiserId ? 'FUNDRAISER' : 'DONATE_PAGE',
    }
    if (validFundraiserId) meta.fundraiserId = validFundraiserId
    if (message) meta.message = message
    if (company) meta.donorCompany = company

    // If this is a migrated donor re-confirming their card, tag it so the
    // webhook can mark the migration complete and flag the gift in reporting.
    if (parsed.data.migrationIntentId) {
      const mi = await prisma.migrationIntent.findUnique({
        where: { id: parsed.data.migrationIntentId },
        select: { status: true, source: true },
      })
      if (mi && mi.status === 'PENDING') {
        meta.migrationIntentId = parsed.data.migrationIntentId
        meta.migratedFrom = mi.source
      }
    }
    if (parsed.data.isTithe) meta.isTithe = 'true'

    const reqOpts = { apiVersion: SUB_API_VERSION }
    const customer = await stripe.customers.create({ email, name }, reqOpts)
    const price = await stripe.prices.create(
      {
        currency: 'aud',
        unit_amount: toCents(amount),
        recurring: { interval: freq.interval, interval_count: freq.interval_count },
        product_data: { name: `${freq.label} donation — ${fund.name}` },
      },
      reqOpts
    )
    const sub = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: meta,
      },
      reqOpts
    )

    const inv = sub.latest_invoice as unknown as {
      payment_intent?: { client_secret?: string | null } | null
    } | null
    const clientSecret = inv?.payment_intent?.client_secret ?? null
    if (!clientSecret) {
      return { success: false, error: 'Could not start recurring payment. Please try again.' }
    }
    return { success: true, clientSecret, accountKey }
  } catch (err) {
    console.error('createDonationSubscriptionIntentAction failed', err)
    return { success: false, error: 'Could not start recurring payment. Please try again.' }
  }
}
