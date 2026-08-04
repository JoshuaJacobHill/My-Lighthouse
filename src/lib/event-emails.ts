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
    when: formatDateTime(order.event.startsAt),
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
