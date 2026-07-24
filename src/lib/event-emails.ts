import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { ORG } from '@/lib/org'
import { formatDateTime } from '@/lib/utils'

const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

/**
 * Email a purchaser their e-tickets for an order, each with its check-in
 * reference. Best-effort: callers must not let a send failure break the flow.
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
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

  const body = `
    <p style="${P}">Hi ${firstName},</p>
    <p style="${P}">
      You&rsquo;re registered for <strong>${order.event.title}</strong>. Here ${
        order.tickets.length === 1 ? 'is your ticket' : 'are your tickets'
      } — please bring the reference code${order.tickets.length === 1 ? '' : 's'} with you.
    </p>
    <p style="${P}">
      <strong>When:</strong> ${formatDateTime(order.event.startsAt)}<br/>
      ${order.event.venue ? `<strong>Where:</strong> ${order.event.venue}<br/>` : ''}
      ${total > 0 ? `<strong>Paid:</strong> ${aud.format(total)}` : '<strong>Free registration</strong>'}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <tr>
        <th style="text-align:left;padding:6px 0;border-bottom:2px solid #e5e7eb;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Ticket</th>
        <th style="text-align:right;padding:6px 0;border-bottom:2px solid #e5e7eb;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Reference</th>
      </tr>
      ${ticketRows}
    </table>
    <p style="${P}">We can&rsquo;t wait to see you there.</p>
    <p style="${P}">Warm regards,<br/>The ${ORG.name} team</p>
  `

  await sendEmail({
    to: order.purchaserEmail,
    subject: `Your tickets — ${order.event.title}`,
    html: wrapEmailHtml(body, appUrl),
  })
}
