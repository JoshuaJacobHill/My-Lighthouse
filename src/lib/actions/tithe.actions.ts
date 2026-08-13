'use server'

import type Stripe from 'stripe'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getStripeFor, isAccountConfigured } from '@/lib/stripe-accounts'

// Tithes settle to the CHURCH account. Match the subscription API version.
const SUB_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion
const ACCOUNT = 'CHURCH' as const

export interface TitheGift {
  id: string
  amount: number
  frequencyLabel: string
  interval: string
  intervalCount: number
  status: string
  statusLabel: string
  active: boolean
  nextChargeAt: number | null
  endedAt: number | null
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Active',
  past_due: 'Payment failed',
  unpaid: 'Unpaid',
  paused: 'Paused',
  canceled: 'Cancelled',
}
const ACTIVE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused'])
const HIDDEN = new Set(['incomplete', 'incomplete_expired'])

function freqLabel(interval: string, count: number): string {
  if (interval === 'week' && count === 1) return 'Weekly'
  if (interval === 'week' && count === 2) return 'Fortnightly'
  if (interval === 'month' && count === 1) return 'Monthly'
  return `Every ${count} ${interval}${count > 1 ? 's' : ''}`
}

async function sessionEmail(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } })
  return user?.email?.toLowerCase() ?? null
}

/** A church giver's recurring tithes, looked up live in Stripe (CHURCH) by email. */
export async function listMyTithes(): Promise<TitheGift[]> {
  const email = await sessionEmail()
  if (!email || !isAccountConfigured(ACCOUNT)) return []
  const opts = { apiVersion: SUB_API_VERSION }
  const stripe = getStripeFor(ACCOUNT)
  const gifts: TitheGift[] = []
  try {
    const customers = await stripe.customers.list({ email, limit: 20 }, opts)
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list(
        { customer: customer.id, status: 'all', limit: 50, expand: ['data.items.data.price'] },
        opts
      )
      for (const s of subs.data) {
        if (s.metadata?.isTithe !== 'true') continue
        if (HIDDEN.has(s.status)) continue
        const price = s.items.data[0]?.price
        const active = ACTIVE.has(s.status)
        gifts.push({
          id: s.id,
          amount: (price?.unit_amount ?? 0) / 100,
          frequencyLabel: freqLabel(price?.recurring?.interval ?? 'week', price?.recurring?.interval_count ?? 1),
          interval: price?.recurring?.interval ?? 'week',
          intervalCount: price?.recurring?.interval_count ?? 1,
          status: s.status,
          statusLabel: STATUS_LABELS[s.status] ?? s.status,
          active,
          nextChargeAt: active ? ((s as unknown as { current_period_end?: number }).current_period_end ?? null) : null,
          endedAt: (s.canceled_at ?? s.ended_at) as number | null,
        })
      }
    }
  } catch (err) {
    console.error('listMyTithes', err)
  }
  gifts.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))
  return gifts
}

/** Change the amount of a recurring tithe in place (new price, same cadence). */
export async function updateTitheAmountAction(
  subscriptionId: string,
  newAmount: number
): Promise<{ success: boolean; error?: string }> {
  const email = await sessionEmail()
  if (!email) return { success: false, error: 'Please sign in again.' }
  if (!isAccountConfigured(ACCOUNT)) return { success: false, error: 'Unavailable right now.' }
  if (!Number.isFinite(newAmount) || newAmount < 2) return { success: false, error: 'Please enter at least $2.' }

  const opts = { apiVersion: SUB_API_VERSION }
  const stripe = getStripeFor(ACCOUNT)
  try {
    const sub = await stripe.subscriptions.retrieve(
      subscriptionId,
      { expand: ['customer', 'items.data.price'] },
      opts
    )
    const customerEmail =
      typeof sub.customer === 'object' && sub.customer && 'email' in sub.customer
        ? ((sub.customer as { email?: string | null }).email ?? '')
        : ''
    const owns =
      customerEmail.toLowerCase() === email || (sub.metadata?.donorEmail ?? '').toLowerCase() === email
    if (!owns || sub.metadata?.isTithe !== 'true') {
      return { success: false, error: 'That tithe isn’t on your account.' }
    }
    if (sub.status === 'canceled') return { success: false, error: 'This tithe has been cancelled.' }

    const item = sub.items.data[0]
    const oldPrice = item?.price
    const interval = oldPrice?.recurring?.interval ?? 'week'
    const intervalCount = oldPrice?.recurring?.interval_count ?? 1

    const price = await stripe.prices.create(
      {
        currency: 'aud',
        unit_amount: Math.round(newAmount * 100),
        recurring: { interval: interval as Stripe.PriceCreateParams.Recurring.Interval, interval_count: intervalCount },
        product_data: { name: 'Tithe — Lighthouse Family Church' },
      },
      opts
    )
    await stripe.subscriptions.update(
      subscriptionId,
      { items: [{ id: item.id, price: price.id }], proration_behavior: 'none' },
      opts
    )
    revalidatePath('/dashboard/tithes')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('updateTitheAmountAction', err)
    return { success: false, error: 'Could not update your tithe. Please try again.' }
  }
}
