'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth'
import { createAccountSetupToken } from '@/lib/account-setup'
import { sendAccountSetupEmail } from '@/lib/donation-emails'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { rateLimit } from '@/lib/rate-limit'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const ORANGE = '#f97316'
const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'
const BTN = `background:${ORANGE};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;`

async function clientIp(): Promise<string> {
  return (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

// ─── Step 1: does this email already have anything on file? ──────────────────

const emailSchema = z.object({ email: z.string().trim().email('Please enter a valid email address') })
export type CheckSignupEmailInput = z.input<typeof emailSchema>

/**
 * Step one of sign-up. If the email already has a record with us (an account, or
 * past giving), we email a link rather than letting anyone claim that history by
 * typing an address — proving control of the inbox is what unlocks the data.
 * A genuinely new email goes straight to the quick sign-up form.
 */
export async function checkSignupEmailAction(
  input: CheckSignupEmailInput
): Promise<{ success: boolean; mode?: 'existing_account' | 'link_sent' | 'new'; error?: string }> {
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please enter a valid email address.' }
  }
  const email = parsed.data.email.toLowerCase()

  const ip = await clientIp()
  if (!rateLimit(`signupcheck:ip:${ip}`, 30, 900_000).ok || !rateLimit(`signupcheck:email:${email}`, 5, 900_000).ok) {
    // Don't reveal anything under load — behave like the "we've emailed you" path.
    return { success: true, mode: 'link_sent' }
  }

  try {
    const [user, giftCount] = await Promise.all([
      prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, name: true, passwordHash: true, isActive: true },
      }),
      prisma.donation.count({ where: { donorEmail: { equals: email, mode: 'insensitive' } } }),
    ])

    // Already set up → tell them on screen so they can just sign in. Sending an
    // email here would leave them waiting for something they don't need.
    if (user?.passwordHash && user.isActive) {
      return { success: true, mode: 'existing_account' }
    }

    // Has history (giving, or a record we created for them) → email a setup link
    // so that data is only ever attached to someone who controls the inbox.
    if (user || giftCount > 0) {
      const token = await createAccountSetupToken(email)
      await sendAccountSetupEmail({ to: email, name: user?.name ?? null, token })
      return { success: true, mode: 'link_sent' }
    }

    // Brand new — let them finish signing up on the spot.
    return { success: true, mode: 'new' }
  } catch (err) {
    console.error('checkSignupEmailAction failed', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
}

// ─── Step 2: quick sign-up for a brand-new email ─────────────────────────────

const createSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
export type CreateAccountInput = z.input<typeof createSchema>

/**
 * Create an account for a new supporter and sign them in immediately. The email
 * is NOT marked verified here — we send a confirmation link for that, because
 * verification is what allows future giving to attach to the account (and stops
 * anyone claiming an address that hasn't given yet).
 */
export async function createAccountAction(
  input: CreateAccountInput
): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { name, company, password } = parsed.data
  const email = parsed.data.email.toLowerCase()

  const ip = await clientIp()
  if (!rateLimit(`signupcreate:ip:${ip}`, 15, 900_000).ok) {
    return { success: false, error: 'Too many attempts. Please wait a moment and try again.' }
  }

  try {
    // Re-check at write time — the email may have gained a record since step one.
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, passwordHash: true },
    })
    // SECURITY: step one routes any known email to an emailed link, so reaching
    // here with an existing record means the UI was bypassed (server actions are
    // directly callable). Refuse regardless of whether a password is set —
    // otherwise a passwordless donor row could be claimed by anyone.
    if (existing) {
      return { success: false, error: 'This email has already been used. Please sign in, or reset your password.' }
    }

    // Only ever creates. Claiming an existing row is refused above, so there is
    // no update path here that could take one over.
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { email, passwordHash, name, company: company?.trim() || null, role: 'VOLUNTEER' },
      select: { id: true },
    })

    await prisma.donorProfile.upsert({
      where: { userId: user.id },
      update: { displayName: name },
      create: { userId: user.id, displayName: name },
    })

    // Confirmation link — verifies the address and links any giving.
    try {
      const token = await createAccountSetupToken(email)
      const firstName = name.split(/\s+/)[0]
      await sendEmail({
        to: email,
        subject: 'Please confirm your email address',
        html: wrapEmailHtml(
          `
          <p style="${P}">Hi ${firstName},</p>
          <p style="${P}">Welcome to the My Lighthouse Portal! Please confirm this is your email address — it means your receipts always reach you, and any giving under this address appears in your account.</p>
          <p style="margin:24px 0;"><a href="${APP_URL}/account/confirm?token=${token}" style="${BTN}">Confirm my email &rarr;</a></p>
          <p style="${P}">This link is valid for 14 days.</p>
          <p style="${P};margin-bottom:0;">With thanks,<br>The Lighthouse Care team</p>
        `,
          APP_URL
        ),
        text: `Hi ${firstName},\n\nWelcome to the My Lighthouse Portal! Please confirm your email address so your receipts reach you and any giving under this address appears in your account:\n\n${APP_URL}/account/confirm?token=${token}\n\n(Valid for 14 days.)\n\nWith thanks,\nThe Lighthouse Care team`,
      })
    } catch (err) {
      console.error('Confirmation email failed', err)
    }

    const session = await createSession(user.id)
    await setSessionCookie(session)
    return { success: true, redirectTo: '/dashboard' }
  } catch (err) {
    console.error('createAccountAction failed', err)
    return { success: false, error: 'Could not create your account. Please try again.' }
  }
}
