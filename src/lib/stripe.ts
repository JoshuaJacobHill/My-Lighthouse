import Stripe from 'stripe'

/**
 * Stripe client (donor portal — see docs/donor-portal-plan.md §4).
 *
 * Lazily constructed so the app still builds/runs when STRIPE_SECRET_KEY is
 * absent (e.g. the volunteer portal, or before keys are set). Only code paths
 * that actually take payments call getStripe(), and they get a clear error if
 * the key is missing rather than a crash at import time.
 *
 * Use TEST keys (sk_test_… / whsec_…) everywhere until launch.
 */

let client: Stripe | null = null

export function getStripe(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add your Stripe test secret key to .env.local.'
    )
  }
  client = new Stripe(key)
  return client
}

/** Whether Stripe is configured (a secret key is present). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Dollars (AUD) → integer cents, as Stripe expects. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}
