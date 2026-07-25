import Stripe from 'stripe'
import { getStripeFor, isAccountConfigured } from './stripe-accounts'

/**
 * Default Stripe client (donor portal — see docs/donor-portal-plan.md §4).
 *
 * The main account is Lighthouse Care. This helper delegates to the two-account
 * registry (src/lib/stripe-accounts.ts) so the env-var names live in one place.
 * Payment-routing code uses getStripeFor(resolveAccount(fund)); the pages that
 * only read a Care checkout session (success/tickets) use this default.
 *
 * Use TEST keys (sk_test_… / whsec_…) everywhere until launch.
 */

export function getStripe(): Stripe {
  return getStripeFor('CARE')
}

/** Whether the default (Care) Stripe account is configured. */
export function isStripeConfigured(): boolean {
  return isAccountConfigured('CARE')
}

/** Dollars (AUD) → integer cents, as Stripe expects. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}
