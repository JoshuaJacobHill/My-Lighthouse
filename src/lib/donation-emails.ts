import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'
import { ORG } from '@/lib/org'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

/**
 * Send a donor a receipt / thank-you email (donor portal — plan §9/§10).
 * Uses the editable DONATION_RECEIPT template (Admin → Emails → Donors).
 * Best-effort: callers should not let a send failure break payment recording.
 */
export async function sendDonationReceiptEmail(opts: {
  to: string
  name?: string | null
  amount: number
  fundName?: string | null
  receiptNo: string
}): Promise<void> {
  const firstName = opts.name?.trim().split(/\s+/)[0] || 'friend'
  const { subject, html, text } = await renderTemplate('DONATION_RECEIPT', {
    first_name: firstName,
    amount: aud.format(opts.amount),
    fund_name: opts.fundName ?? 'our work',
    receipt_no: opts.receiptNo,
    abn: ORG.abn,
    organisation_name: ORG.name,
  })
  await sendEmail({ to: opts.to, subject, html, text, templateType: 'DONATION_RECEIPT' })
}

/**
 * Invite a first-time donor to finish setting up an account (set a password).
 * Uses the editable DONOR_ACCOUNT_SETUP template.
 */
export async function sendAccountSetupEmail(opts: {
  to: string
  name?: string | null
  token: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
  const firstName = opts.name?.trim().split(/\s+/)[0] || 'friend'
  const link = `${appUrl}/account/setup?token=${opts.token}`
  const { subject, html, text } = await renderTemplate('DONOR_ACCOUNT_SETUP', {
    first_name: firstName,
    set_password_link: link,
    organisation_name: ORG.name,
  })
  await sendEmail({ to: opts.to, subject, html, text, templateType: 'DONOR_ACCOUNT_SETUP' })
}
