import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'
import { ORG } from '@/lib/org'
import { formatDateTime } from '@/lib/utils'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

/**
 * Email a purchaser their e-tickets for an order, each with its check-in
 * reference. Uses the editable TICKET_CONFIRMATION template — the ticket table
 * and event details are injected as the {{tickets}}/{{when}}/{{where}}/{{paid}}
 * variables, so the surrounding copy stays admin-editable.
 * Best-effort: callers must not let a send failure break the flow.
 */
export async function sendTicketConfirmationEmailForOrder(orderId: string): Promise<void> {
  const order = await prisma.ticketOrder.findUnique({
    where: { id: orderId },
    select: {
      purchaserName: true,
      purchaserEmail: true,
      amountTotal: true,
      event: { select: { title: true, venue: true, startsAt: true } },
      tickets: {
        select: { reference: true, ticketType: { select: { name: true } } },
        orderBy: { reference: 'asc' },
      },
    },
  })
  if (!order) return

  const firstName = order.purchaserName?.trim().split(/\s+/)[0] || 'friend'
  const total = Number(order.amountTotal)

  const ticketRows = order.tickets
    .map(
      (t) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;color:#374151;font-size:14px;">${t.ticketType.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;color:#111827;font-size:14px;font-weight:600;text-align:right;font-family:monospace;">${t.reference}</td>
      </tr>`
    )
    .join('')

  const ticketsTable = `
    <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <tr>
        <th style="text-align:left;padding:6px 0;border-bottom:2px solid #e5e7eb;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Ticket</th>
        <th style="text-align:right;padding:6px 0;border-bottom:2px solid #e5e7eb;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Reference</th>
      </tr>
      ${ticketRows}
    </table>`

  const { subject, html, text } = await renderTemplate('TICKET_CONFIRMATION', {
    first_name: firstName,
    event_name: order.event.title,
    when: order.event.startsAt ? formatDateTime(order.event.startsAt) : 'To be advised',
    where: order.event.venue ? `<strong>Where:</strong> ${order.event.venue}<br>` : '',
    paid: total > 0 ? `<strong>Paid:</strong> ${aud.format(total)}` : '<strong>Free registration</strong>',
    tickets: ticketsTable,
    organisation_name: ORG.name,
  })

  await sendEmail({
    to: order.purchaserEmail,
    subject,
    html,
    text,
    templateType: 'TICKET_CONFIRMATION',
  })
}

/**
 * Invite a ticket buyer to finish setting up an account.
 *
 * Buying a ticket is often somebody's first contact with us, and until now it
 * left them with an e-ticket and nothing else — no way to see what they had
 * booked, change it, or find next year's event. This closes that.
 *
 * Reuses the donor "set up your account" path rather than inventing a second
 * one: the same token table, the same editable DONOR_ACCOUNT_SETUP template,
 * the same /account/setup page. A ticket buyer and a first-time donor are the
 * same situation — somebody who gave us money and an email address but has no
 * password.
 *
 * Deliberately NOT sent when:
 *
 *   The order already belongs to an account. They have one; the tickets are
 *   already on it.
 *
 *   A verified account exists on that email. Same reason, and a "finish
 *   setting up" email to someone who finished months ago reads as a phish.
 *
 *   One was sent for this email in the last fortnight. Stripe retries
 *   webhooks, and somebody buying tickets to two events in a week should not
 *   get two of these.
 *
 * No account is created here. The token is keyed to the email and the record
 * appears only when they choose to set a password — buying a ticket is not
 * consent to being given a login.
 *
 * Best effort, like the ticket email above: a failure here must never affect
 * whether somebody got the thing they paid for.
 */
export async function inviteTicketPurchaserToAccount(orderId: string): Promise<void> {
  try {
    const order = await prisma.ticketOrder.findUnique({
      where: { id: orderId },
      select: { userId: true, purchaserEmail: true, purchaserName: true },
    })
    if (!order?.purchaserEmail) return
    if (order.userId) return

    const email = order.purchaserEmail.trim().toLowerCase()

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { emailVerified: true },
    })
    if (existing?.emailVerified) return

    const fortnightAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const alreadyAsked = await prisma.emailLog.count({
      where: {
        to: { equals: email, mode: 'insensitive' },
        templateType: 'DONOR_ACCOUNT_SETUP',
        createdAt: { gt: fortnightAgo },
      },
    })
    if (alreadyAsked > 0) return

    const { createAccountSetupToken } = await import('@/lib/account-setup')
    const { sendAccountSetupEmail } = await import('@/lib/donation-emails')

    const token = await createAccountSetupToken(email)
    await sendAccountSetupEmail({ to: email, name: order.purchaserName, token })
  } catch (err) {
    console.error('inviteTicketPurchaserToAccount failed', err)
  }
}
