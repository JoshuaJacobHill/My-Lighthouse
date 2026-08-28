'use server'

import crypto from 'crypto'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { canAddEmail } from '@/lib/user-emails'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const P = 'margin:0 0 16px 0;line-height:1.7;color:#374151;font-size:15px;'
const LINK_HOURS = 24
/** Adding an address sends mail to it, so it needs a ceiling. */
const MAX_PENDING = 3

interface Result {
  success: boolean
  error?: string
  message?: string
}

const emailSchema = z.string().trim().toLowerCase().email('Please enter a valid email address.')

function newToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

async function requireUser() {
  const session = await getSession()
  if (!session) return null
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  })
}

async function sendVerification(to: string, name: string | null, token: string) {
  const link = `${APP_URL}/account/verify-email/${token}`
  const firstName = name?.trim().split(/\s+/)[0] || 'there'
  await sendEmail({
    to,
    subject: 'Confirm this email address',
    html: wrapEmailHtml(
      `
      <p style="${P}">Hi ${firstName},</p>
      <p style="${P}">Someone asked to add <strong>${to}</strong> to a My Lighthouse Portal account. Confirming it means any giving under this address shows up in one place with the rest of your history.</p>
      <p style="margin:22px 0;"><a href="${link}" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Confirm this address &rarr;</a></p>
      <p style="${P}">The link works for the next ${LINK_HOURS} hours. You&rsquo;ll need to be signed in to the account when you click it.</p>
      <p style="${P};margin-bottom:0;">If this wasn&rsquo;t you, just ignore this email &mdash; nothing will be linked.</p>
    `,
      APP_URL
    ),
    text: `Hi ${firstName},\n\nSomeone asked to add ${to} to a My Lighthouse Portal account.\n\nConfirm it here (works for ${LINK_HOURS} hours, and you'll need to be signed in):\n${link}\n\nIf this wasn't you, ignore this email — nothing will be linked.`,
  })
}

/**
 * Add an address, pending confirmation from its own inbox.
 *
 * Two separate notifications go out on purpose: the confirmation to the new
 * address, and a heads-up to the existing one. If someone else ever has hold of
 * a session, the account's owner finds out about it.
 */
export async function addEmailAction(input: { email: string }): Promise<Result> {
  const me = await requireUser()
  if (!me) return { success: false, error: 'Please sign in.' }

  const parsed = emailSchema.safeParse(input.email)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid email.' }
  const email = parsed.data

  const pending = await prisma.userEmail.count({ where: { userId: me.id, verifiedAt: null } })
  if (pending >= MAX_PENDING) {
    return { success: false, error: 'You have a few addresses waiting to be confirmed already. Sort those first.' }
  }

  const check = await canAddEmail(me.id, email)
  if (!check.ok) return { success: false, error: check.reason }

  const token = newToken()
  try {
    await prisma.userEmail.create({
      data: {
        userId: me.id,
        email,
        token,
        tokenExpiresAt: new Date(Date.now() + LINK_HOURS * 60 * 60 * 1000),
      },
    })
  } catch (err) {
    console.error('addEmailAction failed', err)
    return { success: false, error: 'Could not add that address. Please try again.' }
  }

  try {
    await sendVerification(email, me.name, token)
  } catch (err) {
    console.error('addEmailAction: verification email failed', err)
    return { success: false, error: 'Added, but we couldn’t send the confirmation email. Try resending it.' }
  }

  if (me.email) {
    try {
      await sendEmail({
        to: me.email,
        subject: 'An email address was added to your account',
        html: wrapEmailHtml(
          `
          <p style="${P}">Hi ${me.name?.trim().split(/\s+/)[0] || 'there'},</p>
          <p style="${P}"><strong>${email}</strong> has been added to your My Lighthouse Portal account and is waiting to be confirmed.</p>
          <p style="${P}">If that was you, nothing more to do &mdash; just click the link we sent to that address.</p>
          <p style="${P};margin-bottom:0;">If it wasn&rsquo;t, please change your password and email <a href="mailto:accounts@lighthousecare.org.au">accounts@lighthousecare.org.au</a> straight away.</p>
        `,
          APP_URL
        ),
        text: `${email} has been added to your My Lighthouse Portal account and is waiting to be confirmed.\n\nIf that wasn't you, please change your password and email accounts@lighthousecare.org.au.`,
      })
    } catch (err) {
      // A missing heads-up shouldn't fail the request the person actually made.
      console.error('addEmailAction: notice to primary failed', err)
    }
  }

  revalidatePath('/dashboard/account')
  return { success: true, message: `We’ve sent a confirmation link to ${email}.` }
}

export async function resendEmailVerificationAction(id: string): Promise<Result> {
  const me = await requireUser()
  if (!me) return { success: false, error: 'Please sign in.' }

  const row = await prisma.userEmail.findFirst({
    where: { id, userId: me.id, verifiedAt: null },
    select: { id: true, email: true },
  })
  if (!row) return { success: false, error: 'Nothing to resend.' }

  const token = newToken()
  await prisma.userEmail.update({
    where: { id: row.id },
    data: { token, tokenExpiresAt: new Date(Date.now() + LINK_HOURS * 60 * 60 * 1000) },
  })
  try {
    await sendVerification(row.email, me.name, token)
  } catch (err) {
    console.error('resendEmailVerificationAction failed', err)
    return { success: false, error: 'Could not send that. Please try again.' }
  }
  revalidatePath('/dashboard/account')
  return { success: true, message: `Sent again to ${row.email}.` }
}

/** Unlink an address. Giving already brought across stays with the account. */
export async function removeEmailAction(id: string): Promise<Result> {
  const me = await requireUser()
  if (!me) return { success: false, error: 'Please sign in.' }

  const deleted = await prisma.userEmail.deleteMany({ where: { id, userId: me.id } })
  if (deleted.count === 0) return { success: false, error: 'That address isn’t on your account.' }

  revalidatePath('/dashboard/account')
  return { success: true, message: 'Address removed.' }
}
