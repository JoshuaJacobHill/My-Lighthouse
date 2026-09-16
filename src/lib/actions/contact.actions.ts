'use server'

import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'

/**
 * The public contact form.
 *
 * Open to anyone, which is the whole difficulty: a form that sends email on
 * an anonymous request is a spam relay unless it is guarded. Three guards,
 * none of which inconvenience a real person:
 *
 *   A honeypot field, hidden from people and filled in by most bots.
 *   A floor on how fast the form can be submitted after it loads.
 *   A cap on how many enquiries an address, and the form overall, can send.
 *
 * None of them are clever. Clever anti-spam annoys real people, and the worst
 * outcome here is a supporter giving up on telling us something.
 */

const TO = 'admin@lighthousecare.org.au'
const BCC = 'josh@lighthousecare.org.au'

/** Nothing legitimate is filled in this quickly. */
const MIN_SECONDS_ON_FORM = 3
/** Per address, per hour. */
const PER_SENDER_LIMIT = 3
/** Across everyone, per hour — a backstop if one address is not the problem. */
const TOTAL_LIMIT = 40

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ContactResult = { success: boolean; error?: string }

export async function sendContactMessageAction(input: {
  name: string
  email: string
  organisation?: string
  message: string
  /** Hidden field. A person never sees it, so a value means a machine. */
  website?: string
  /** When the form was rendered, in milliseconds. */
  loadedAt?: number
}): Promise<ContactResult> {
  // Silently accepted rather than refused. Telling a bot it was detected only
  // teaches whoever wrote it to fill the field in next time.
  if (input.website?.trim()) return { success: true }

  if (input.loadedAt && Date.now() - input.loadedAt < MIN_SECONDS_ON_FORM * 1000) {
    return { success: false, error: 'That was quick — give it a moment and try again.' }
  }

  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  const message = input.message?.trim()
  const organisation = input.organisation?.trim()

  if (!name) return { success: false, error: 'Please tell us your name.' }
  if (!email || !EMAIL_RE.test(email)) {
    return { success: false, error: 'Please check the email address.' }
  }
  if (!message || message.length < 10) {
    return { success: false, error: 'Please tell us a little more.' }
  }
  if (message.length > 4000) {
    return { success: false, error: 'That is a bit long for this form — could you summarise?' }
  }

  // Rate limiting off the existing email log, rather than a new table. It
  // already records every send with a subject, which is enough to count.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const [fromThisSender, fromEveryone] = await Promise.all([
    prisma.emailLog.count({
      where: { createdAt: { gt: hourAgo }, subject: { contains: `[${email}]` } },
    }),
    prisma.emailLog.count({
      where: { createdAt: { gt: hourAgo }, subject: { startsWith: 'Website enquiry' } },
    }),
  ])

  if (fromThisSender >= PER_SENDER_LIMIT || fromEveryone >= TOTAL_LIMIT) {
    return {
      success: false,
      error: 'We have your message already — if it is urgent, please call the store.',
    }
  }

  // The address goes in the subject so the rate limit above can count it, and
  // so a reply from a phone shows who it is from before opening anything.
  const subject = `Website enquiry from ${name} [${email}]`

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const P = 'margin:0 0 16px 0;line-height:1.7;color:#374151;font-size:15px;'

  const result = await sendEmail({
    to: TO,
    bcc: BCC,
    subject,
    // So hitting reply answers the person who wrote in, not our own inbox.
    replyTo: email,
    html: wrapEmailHtml(
      `
      <p style="${P}"><strong>${escape(name)}</strong>${organisation ? ` — ${escape(organisation)}` : ''}</p>
      <p style="${P}"><a href="mailto:${escape(email)}">${escape(email)}</a></p>
      <div style="${P};white-space:pre-line;border-left:3px solid #f97316;padding-left:14px;">${escape(message)}</div>
      <p style="${P};color:#9ca3af;font-size:13px;margin-bottom:0;">Sent from the contact form on my.lighthousecare.org.au</p>
    `,
      'https://my.lighthousecare.org.au',
    ),
    text: `${name}${organisation ? ` — ${organisation}` : ''}\n${email}\n\n${message}\n\nSent from the contact form.`,
  })

  if (!result.success) {
    // The real reason goes to the log, not to the sender: it may name our mail
    // provider or its configuration, and there is nothing they could do with it.
    console.error('[contact] send failed', result.error)
    return {
      success: false,
      error: 'Something went wrong sending that. Please try again, or call the store.',
    }
  }

  return { success: true }
}
