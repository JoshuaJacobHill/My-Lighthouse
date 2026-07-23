import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { ORG } from '@/lib/org'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'

/**
 * Send a donor a receipt / thank-you email (donor portal — plan §9/§10).
 * Best-effort: callers should not let a send failure break payment recording.
 */
export async function sendDonationReceiptEmail(opts: {
  to: string
  name?: string | null
  amount: number
  fundName?: string | null
  receiptNo: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
  const firstName = opts.name?.trim().split(/\s+/)[0] || 'friend'
  const fund = opts.fundName ?? 'our work'

  const body = `
    <p style="${P}">Hi ${firstName},</p>
    <p style="${P}">
      Thank you for your gift of <strong>${aud.format(opts.amount)}</strong> to ${fund}.
      Because of you, families doing it tough across South East Queensland have a little
      more hope this week.
    </p>
    <p style="${P}">
      This email is your receipt. Receipt number <strong>${opts.receiptNo}</strong>,
      issued by ${ORG.name} (ABN ${ORG.abn}). You can also view and download your
      receipts any time from your giving history.
    </p>
    <p style="${P}">
      <a href="${appUrl}/donor" style="color:#f97316;font-weight:600;">View my giving</a>
    </p>
    <p style="${P}">With heartfelt thanks,<br/>The ${ORG.name} team</p>
  `

  await sendEmail({
    to: opts.to,
    subject: `Thank you for your gift to ${ORG.name}`,
    html: wrapEmailHtml(body, appUrl),
  })
}
