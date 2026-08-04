import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createPasswordResetToken } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'

const ORANGE = '#f97316'
const TEXT = '#374151'
const P = `margin:0 0 18px 0;line-height:1.7;color:${TEXT};font-size:15px;`
const BTN = `background:${ORANGE};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;`

export async function POST(req: NextRequest) {
  let email: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ success: true })
  }

  if (!email) {
    return NextResponse.json({ success: true })
  }

  // Look up user — don't reveal whether or not they exist
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Send a reset link to ANY account with a login — volunteers, donors AND
    // admins (previously only volunteers got the email, locking admins out).
    if (user && user.isActive) {
      const token = await createPasswordResetToken(user.id, 48)
      const resetLink = `${APP_URL}/set-password?token=${token}`

      const firstName = user.name?.split(' ')[0] ?? 'there'

      const html = wrapEmailHtml(`
        <p style="${P}">Hi ${firstName},</p>
        <p style="${P}">We received a request to reset your Lighthouse Care Volunteers password. Click the button below to choose a new password.</p>
        <p style="margin:24px 0;"><a href="${resetLink}" style="${BTN}">Reset My Password &rarr;</a></p>
        <p style="${P}">This link will expire in <strong>48 hours</strong>. If you didn&rsquo;t request a password reset, you can safely ignore this email.</p>
        <p style="${P};margin-bottom:0;">Warm regards,<br>The Lighthouse Care Team</p>
      `, APP_URL)

      await sendEmail({
        to: email,
        subject: 'Reset your Lighthouse Care Volunteers password',
        html,
        text: `Hi ${firstName},\n\nWe received a request to reset your Lighthouse Care Volunteers password.\n\nReset your password here (link valid for 48 hours):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.\n\nWarm regards,\nThe Lighthouse Care Team`,
      })
    }
  } catch {
    // Swallow errors — never reveal account existence or internal errors
  }

  return NextResponse.json({ success: true })
}
