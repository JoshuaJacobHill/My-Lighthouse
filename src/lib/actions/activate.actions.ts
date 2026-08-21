'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { createPasswordResetToken } from '@/lib/auth'
import { createAccountSetupToken } from '@/lib/account-setup'
import { sendAccountSetupEmail } from '@/lib/donation-emails'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { rateLimit } from '@/lib/rate-limit'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const ORANGE = '#f97316'
const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'
const BTN = `background:${ORANGE};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;`

const schema = z.object({ email: z.string().trim().email('Please enter a valid email address') })
export type RequestActivationInput = z.input<typeof schema>

/**
 * Self-serve "activate my account" — the single evergreen link we can put in a
 * newsletter, on the website or on socials.
 *
 * Whoever enters their email gets a link sent to that address; we never reveal
 * on-screen whether the email is known, has giving history, or already has an
 * account (that would leak who supports Lighthouse Care). Proving control of the
 * inbox is what allows past giving to be attached — see completeDonorAccountAction.
 */
export async function requestActivationLinkAction(
  input: RequestActivationInput
): Promise<{ success: boolean; error?: string }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please enter a valid email address.' }
  }
  const email = parsed.data.email.toLowerCase()

  // Throttle so this can't be used to spam arbitrary inboxes. Deliberately
  // returns the same generic success so nothing is revealed.
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`activate:ip:${ip}`, 10, 900_000).ok || !rateLimit(`activate:email:${email}`, 3, 900_000).ok) {
    return { success: true }
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, name: true, passwordHash: true, isActive: true },
    })

    if (user?.passwordHash && user.isActive) {
      // Already set up — send a sign-in / reset link instead of a setup link.
      const token = await createPasswordResetToken(user.id, 48)
      const resetLink = `${APP_URL}/set-password?token=${token}`
      const firstName = user.name?.trim().split(/\s+/)[0] || 'there'
      await sendEmail({
        to: email,
        subject: 'You already have a My Lighthouse account',
        html: wrapEmailHtml(
          `
          <p style="${P}">Hi ${firstName},</p>
          <p style="${P}">Good news — you already have a My Lighthouse Portal account for this email address, so there&rsquo;s nothing to set up.</p>
          <p style="margin:24px 0;"><a href="${APP_URL}/login" style="${BTN}">Sign in to my portal &rarr;</a></p>
          <p style="${P}">If you&rsquo;ve forgotten your password, you can <a href="${resetLink}" style="color:${ORANGE};font-weight:600;">choose a new one here</a> (that link is valid for 48 hours).</p>
          <p style="${P};margin-bottom:0;">With thanks,<br>The Lighthouse Care team</p>
        `,
          APP_URL
        ),
        text: `Hi ${firstName},\n\nYou already have a My Lighthouse Portal account for this email address, so there's nothing to set up.\n\nSign in: ${APP_URL}/login\n\nForgotten your password? Choose a new one (valid 48 hours):\n${resetLink}\n\nWith thanks,\nThe Lighthouse Care team`,
      })
      return { success: true }
    }

    // Everyone else — new contact, or a record with no password yet. The setup
    // link creates/completes the account and attaches any past giving.
    const token = await createAccountSetupToken(email)
    await sendAccountSetupEmail({ to: email, name: user?.name ?? null, token })
    return { success: true }
  } catch (err) {
    console.error('requestActivationLinkAction failed', err)
    // Still generic — don't hand an attacker a signal, and don't alarm a
    // legitimate supporter mid-flow.
    return { success: true }
  }
}
