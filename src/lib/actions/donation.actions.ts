'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { getStripe, isStripeConfigured, toCents } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'

interface CheckoutResult {
  success: boolean
  error?: string
  url?: string
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
  const { fundSlug, amount, name, email, fundraiserId } = parsed.data

  const fund = await prisma.fund.findUnique({
    where: { slug: fundSlug },
    select: { id: true, name: true, slug: true, isActive: true },
  })
  if (!fund || !fund.isActive) {
    return { success: false, error: 'That fund isn’t available right now.' }
  }

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
      source: validFundraiserId ? 'FUNDRAISER' : 'DONATE_PAGE',
    }
    if (validFundraiserId) meta.fundraiserId = validFundraiserId
    const cancelUrl = validFundraiserId
      ? `${base}/donate?fundraiser=${fundraiserId}&cancelled=1`
      : `${base}/donate?fund=${fund.slug}&cancelled=1`
    const session = await getStripe().checkout.sessions.create({
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
