import type Stripe from 'stripe'
import { getStripeFor, isAccountConfigured, type StripeAccountKey } from '@/lib/stripe-accounts'

// Admin-side recurring lookups (read-only). Live Stripe; not user-scoped.
const SUB_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion
const ACCOUNTS: StripeAccountKey[] = ['CARE', 'CHURCH']
const ACTIVE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused'])

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Active',
  past_due: 'Payment failed',
  unpaid: 'Unpaid',
  paused: 'Paused',
  canceled: 'Cancelled',
}

function freqLabel(interval: string, count: number): string {
  if (interval === 'week' && count === 1) return 'Weekly'
  if (interval === 'week' && count === 2) return 'Fortnightly'
  if (interval === 'month' && count === 1) return 'Monthly'
  return `Every ${count} ${interval}${count > 1 ? 's' : ''}`
}

/**
 * The set of lowercase emails that currently have at least one live (active-ish)
 * recurring subscription, across both accounts. Used to flag recurring gifts on
 * the transactions list as active/inactive. Best-effort; capped pagination.
 */
export async function listActiveRecurringEmails(): Promise<Set<string>> {
  const emails = new Set<string>()
  const opts = { apiVersion: SUB_API_VERSION }
  for (const account of ACCOUNTS) {
    if (!isAccountConfigured(account)) continue
    try {
      const stripe = getStripeFor(account)
      let startingAfter: string | undefined
      for (let pageN = 0; pageN < 20; pageN++) {
        const subs = await stripe.subscriptions.list(
          { status: 'active', limit: 100, expand: ['data.customer'], ...(startingAfter ? { starting_after: startingAfter } : {}) },
          opts
        )
        for (const s of subs.data) {
          const cust = s.customer
          if (typeof cust === 'object' && cust && 'email' in cust) {
            const e = (cust as { email?: string | null }).email
            if (e) emails.add(e.toLowerCase())
          }
          const metaEmail = s.metadata?.donorEmail
          if (metaEmail) emails.add(metaEmail.toLowerCase())
        }
        if (!subs.has_more || subs.data.length === 0) break
        startingAfter = subs.data[subs.data.length - 1].id
      }
    } catch (err) {
      console.error('listActiveRecurringEmails', account, err)
    }
  }
  return emails
}

export interface AdminRecurringGift {
  id: string
  account: StripeAccountKey
  amount: number
  frequencyLabel: string
  status: string
  statusLabel: string
  active: boolean
  isTithe: boolean
  nextChargeAt: number | null
  endedAt: number | null
}

/** All recurring subscriptions for one email (any status), for the user profile. */
export async function listRecurringForEmail(email: string): Promise<AdminRecurringGift[]> {
  const lower = email.trim().toLowerCase()
  const opts = { apiVersion: SUB_API_VERSION }
  const gifts: AdminRecurringGift[] = []
  for (const account of ACCOUNTS) {
    if (!isAccountConfigured(account)) continue
    try {
      const stripe = getStripeFor(account)
      const customers = await stripe.customers.list({ email: lower, limit: 20 }, opts)
      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list(
          { customer: customer.id, status: 'all', limit: 50, expand: ['data.items.data.price'] },
          opts
        )
        for (const s of subs.data) {
          if (s.status === 'incomplete' || s.status === 'incomplete_expired') continue
          const price = s.items.data[0]?.price
          gifts.push({
            id: s.id,
            account,
            amount: (price?.unit_amount ?? 0) / 100,
            frequencyLabel: freqLabel(price?.recurring?.interval ?? 'month', price?.recurring?.interval_count ?? 1),
            status: s.status,
            statusLabel: STATUS_LABELS[s.status] ?? s.status,
            active: ACTIVE.has(s.status),
            isTithe: s.metadata?.isTithe === 'true',
            nextChargeAt: ACTIVE.has(s.status)
              ? ((s as unknown as { current_period_end?: number }).current_period_end ?? null)
              : null,
            endedAt: (s.canceled_at ?? s.ended_at) as number | null,
          })
        }
      }
    } catch (err) {
      console.error('listRecurringForEmail', account, err)
    }
  }
  gifts.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
  return gifts
}
