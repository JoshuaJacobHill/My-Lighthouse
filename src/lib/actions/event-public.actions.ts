'use server'

import { z } from 'zod'
import { revalidatePath, updateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isStripeConfigured, toCents } from '@/lib/stripe'
import { getStripeFor, resolveAccount } from '@/lib/stripe-accounts'
import { SPONSOR_TIERS, normaliseWebsiteUrl } from '@/lib/sponsor-tiers'
import { EVENTS_TAG } from '@/lib/event-data'

const schema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.email('Please enter a valid email'),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
})

export type EventVolunteerInput = z.input<typeof schema>

/** Sign up to volunteer at an event (capacity-checked, one per email). */
export async function signUpEventVolunteerAction(
  input: EventVolunteerInput
): Promise<{ success: boolean; error?: string; already?: boolean }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { eventId, name, email, phone } = parsed.data
  const lowerEmail = email.toLowerCase()

  const event = await prisma.event.findFirst({
    where: { id: eventId, isPublished: true, allowVolunteers: true },
    select: { id: true, slug: true, volunteerCapacity: true },
  })
  if (!event) return { success: false, error: 'Volunteering isn’t open for this event.' }

  // Already signed up? Treat as success (idempotent).
  const existing = await prisma.eventVolunteer.findUnique({
    where: { eventId_email: { eventId, email: lowerEmail } },
    select: { id: true },
  })
  if (existing) {
    return { success: true, already: true }
  }

  // Capacity check.
  if (event.volunteerCapacity != null) {
    const count = await prisma.eventVolunteer.count({ where: { eventId } })
    if (count >= event.volunteerCapacity) {
      return { success: false, error: 'Sorry — volunteer spots for this event are full.' }
    }
  }

  const session = await getSession()
  await prisma.eventVolunteer.create({
    data: {
      eventId,
      userId: session?.userId ?? null,
      name,
      email: lowerEmail,
      phone: phone || null,
    },
  })

  updateTag(EVENTS_TAG)
  revalidatePath(`/events/${event.slug}`)
  return { success: true }
}

// ─── Event sponsorship (Bronze / Silver / Gold) ──────────────────────────────

const sponsorSchema = z.object({
  eventId: z.string().min(1),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD']),
  amount: z.coerce.number(),
  businessName: z.string().trim().min(1, 'Please enter your business name').max(160),
  websiteUrl: z.string().trim().max(200).optional().or(z.literal('')),
  contactName: z.string().trim().max(120).optional().or(z.literal('')),
  contactEmail: z.email('Please enter a valid email'),
  logoUrl: z.string().max(800_000).optional().or(z.literal('')), // data URL (client-compressed)
})
export type EventSponsorInput = z.input<typeof sponsorSchema>

/**
 * Start an event sponsorship: validate the tier/amount, create the (unpaid)
 * EventSponsor with its logo, and return a PaymentIntent client secret. The gift
 * is confirmed + the logo goes live via the webhook (finalizeDonation).
 */
export async function startEventSponsorAction(
  input: EventSponsorInput
): Promise<{ success: boolean; error?: string; clientSecret?: string; accountKey?: 'CARE' | 'CHURCH' }> {
  if (!isStripeConfigured()) return { success: false, error: 'Payments aren’t configured yet.' }

  const parsed = sponsorSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { eventId, tier, amount, businessName, websiteUrl, contactName, contactEmail, logoUrl } = parsed.data

  const range = SPONSOR_TIERS[tier]
  if (!Number.isFinite(amount) || amount < range.min || amount > range.max) {
    return { success: false, error: `${range.label} sponsorship is between $${range.min} and $${range.max}.` }
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, isPublished: true, allowSponsors: true },
    select: { id: true, slug: true, title: true, fund: { select: { id: true, slug: true, depositAccount: true } } },
  })
  if (!event || !event.fund) return { success: false, error: 'Sponsorship isn’t available for this event.' }

  const accountKey = resolveAccount(event.fund.depositAccount)
  const session = await getSession()

  try {
    const sponsor = await prisma.eventSponsor.create({
      data: {
        eventId: event.id,
        userId: session?.userId ?? null,
        businessName,
        tier,
        amount,
        logoUrl: logoUrl || null,
        websiteUrl: normaliseWebsiteUrl(websiteUrl),
        contactName: contactName || null,
        contactEmail,
        paid: false,
      },
      select: { id: true },
    })

    const intent = await getStripeFor(accountKey).paymentIntents.create({
      amount: toCents(amount),
      currency: 'aud',
      receipt_email: contactEmail,
      description: `${range.label} sponsor — ${event.title}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: 'donation',
        fundId: event.fund.id,
        fundSlug: event.fund.slug,
        donorName: businessName,
        donorEmail: contactEmail,
        donorCompany: businessName,
        account: accountKey,
        source: 'EVENT',
        eventSponsorId: sponsor.id,
        isSponsor: 'true',
      },
    })
    if (!intent.client_secret) return { success: false, error: 'Could not start payment. Please try again.' }
    return { success: true, clientSecret: intent.client_secret, accountKey }
  } catch (err) {
    console.error('startEventSponsorAction failed', err)
    return { success: false, error: 'Could not start payment. Please try again.' }
  }
}
