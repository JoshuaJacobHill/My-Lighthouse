import type Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { getStripeFor, type StripeAccountKey } from '@/lib/stripe-accounts'

// Pin a modern API version (matches the subscription calls) so CustomerSession
// and saved-card features behave consistently regardless of the account default.
const API_VERSION = '2024-06-20' as Stripe.LatestApiVersion

/**
 * Get (or lazily create) the reusable Stripe customer for a donor on a given
 * account. We store only the customer id — the card itself never touches us.
 */
export async function ensureStripeCustomer(opts: {
  userId: string
  email: string
  name?: string | null
  account: StripeAccountKey
}): Promise<string> {
  const existing = await prisma.stripeCustomer.findUnique({
    where: { userId_account: { userId: opts.userId, account: opts.account } },
    select: { customerId: true },
  })
  if (existing) return existing.customerId

  const stripe = getStripeFor(opts.account)
  const customer = await stripe.customers.create(
    { email: opts.email, name: opts.name ?? undefined, metadata: { userId: opts.userId } },
    { apiVersion: API_VERSION }
  )

  try {
    await prisma.stripeCustomer.create({
      data: { userId: opts.userId, account: opts.account, customerId: customer.id },
    })
  } catch {
    // Lost a race — another request created it first. Use the stored one.
    const row = await prisma.stripeCustomer.findUnique({
      where: { userId_account: { userId: opts.userId, account: opts.account } },
      select: { customerId: true },
    })
    if (row) return row.customerId
  }
  return customer.id
}

/**
 * Create a CustomerSession so the Payment Element can show the donor's saved
 * cards and let them save/remove. Best-effort — callers should fall back to a
 * plain Payment Element if this returns null.
 */
export async function createPaymentCustomerSession(
  account: StripeAccountKey,
  customerId: string
): Promise<string | null> {
  try {
    const stripe = getStripeFor(account)
    const session = await stripe.customerSessions.create(
      {
        customer: customerId,
        components: {
          payment_element: {
            enabled: true,
            features: {
              payment_method_redisplay: 'enabled',
              payment_method_save: 'enabled',
              payment_method_save_usage: 'off_session',
              payment_method_remove: 'enabled',
            },
          },
        },
      },
      { apiVersion: API_VERSION }
    )
    return session.client_secret
  } catch (err) {
    console.error('createPaymentCustomerSession failed', err)
    return null
  }
}
