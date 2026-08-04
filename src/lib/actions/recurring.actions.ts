'use server'

import type Stripe from 'stripe'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getStripeFor, isAccountConfigured, type StripeAccountKey } from '@/lib/stripe-accounts'

// Match the version used when the subscription was created.
const SUB_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion
const ACCOUNTS: StripeAccountKey[] = ['CARE', 'CHURCH']

export interface RecurringGift {
  id: string
  account: StripeAccountKey
  amount: number
  frequencyLabel: string
  fundName: string | null
  nextChargeAt: number | null // unix seconds
}

function freqLabel(interval: string, count: number): string {
  if (interval === 'week' && count === 1) return 'Weekly'
  if (interval === 'week' && count === 2) return 'Fortnightly'
  if (interval === 'month' && count === 1) return 'Monthly'
  return `Every ${count} ${interval}${count > 1 ? 's' : ''}`
}

/** A donor's active recurring gifts, looked up live in Stripe by their email. */
export async function listMyRecurringGifts(): Promise<RecurringGift[]> {
  const session = await getSession()
  if (!session) return []
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } })
  if (!user?.email) return []
  const email = user.email.toLowerCase()

  const gifts: (RecurringGift & { fundSlug?: string })[] = []
  const opts = { apiVersion: SUB_API_VERSION }

  for (const account of ACCOUNTS) {
    if (!isAccountConfigured(account)) continue
    try {
      const stripe = getStripeFor(account)
      const customers = await stripe.customers.list({ email, limit: 20 }, opts)
      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list(
          { customer: customer.id, status: 'active', limit: 50, expand: ['data.items.data.price'] },
          opts
        )
        for (const s of subs.data) {
          const price = s.items.data[0]?.price
          gifts.push({
            id: s.id,
            account,
            amount: (price?.unit_amount ?? 0) / 100,
            frequencyLabel: freqLabel(price?.recurring?.interval ?? 'month', price?.recurring?.interval_count ?? 1),
            fundName: null,
            fundSlug: s.metadata?.fundSlug,
            nextChargeAt:
              (s as unknown as { current_period_end?: number }).current_period_end ?? null,
          })
        }
      }
    } catch (err) {
      console.error('listMyRecurringGifts', account, err)
    }
  }

  // Resolve fund names from slugs.
  const slugs = [...new Set(gifts.map((g) => g.fundSlug).filter(Boolean) as string[])]
  if (slugs.length) {
    const funds = await prisma.fund.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } })
    const bySlug = new Map(funds.map((f) => [f.slug, f.name]))
    for (const g of gifts) g.fundName = g.fundSlug ? bySlug.get(g.fundSlug) ?? null : null
  }

  return gifts.map(({ fundSlug: _drop, ...g }) => g)
}

/** Cancel one of the signed-in donor's own recurring gifts. */
export async function cancelMyRecurringGift(
  subscriptionId: string,
  account: StripeAccountKey
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in again.' }
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } })
  if (!user?.email) return { success: false, error: 'No account email on file.' }
  if (!isAccountConfigured(account)) return { success: false, error: 'Unavailable right now.' }

  const email = user.email.toLowerCase()
  const opts = { apiVersion: SUB_API_VERSION }
  try {
    const stripe = getStripeFor(account)
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] }, opts)
    const customerEmail =
      typeof sub.customer === 'object' && sub.customer && 'email' in sub.customer
        ? ((sub.customer as { email?: string | null }).email ?? '')
        : ''
    const owns =
      customerEmail.toLowerCase() === email ||
      (sub.metadata?.donorEmail ?? '').toLowerCase() === email
    if (!owns) return { success: false, error: 'That recurring gift isn’t on your account.' }

    await stripe.subscriptions.cancel(subscriptionId, {}, opts)
    revalidatePath('/donor/recurring')
    revalidatePath('/donor')
    return { success: true }
  } catch (err) {
    console.error('cancelMyRecurringGift', err)
    return { success: false, error: 'Could not cancel your recurring gift. Please try again.' }
  }
}
