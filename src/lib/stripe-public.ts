import { loadStripe, type Stripe } from '@stripe/stripe-js'

/**
 * Client-side Stripe publishable keys, one per account (see stripe-accounts.ts).
 * Publishable keys are safe to expose in the browser. These MUST be referenced
 * as literal `process.env.NEXT_PUBLIC_*` so Next.js inlines them at build time.
 */
export function publishableKeyFor(account: 'CARE' | 'CHURCH'): string | undefined {
  return account === 'CHURCH'
    ? process.env.NEXT_PUBLIC_STRIPE_CHURCH_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_STRIPE_CARE_PUBLISHABLE_KEY
}

// Cache one loadStripe() promise per publishable key — Stripe.js should only be
// loaded once per key, not on every render.
const promises: Record<string, Promise<Stripe | null>> = {}

export function stripePromiseFor(account: 'CARE' | 'CHURCH'): Promise<Stripe | null> | null {
  const pk = publishableKeyFor(account)
  if (!pk) return null
  if (!promises[pk]) promises[pk] = loadStripe(pk)
  return promises[pk]
}
