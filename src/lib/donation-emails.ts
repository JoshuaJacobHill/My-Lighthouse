import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'
import { wrapChurchEmailHtml } from '@/lib/email-html'
import { ORG } from '@/lib/org'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

// Tithe emails come from the church, not Lighthouse Care.
const CHURCH_FROM = 'Lighthouse Family Church <no-reply@lighthousecare.org.au>'
const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'

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

/**
 * Tithe receipt — from Lighthouse Family Church, simple thank-you + confirmation.
 * No Lighthouse Care branding or "families doing it tough" language.
 */
export async function sendTitheReceiptEmail(opts: {
  to: string
  name?: string | null
  amount: number
  receiptNo: string
}): Promise<void> {
  const firstName = opts.name?.trim().split(/\s+/)[0] || 'friend'
  const html = wrapChurchEmailHtml(`
    <p style="${P}">Hi ${firstName},</p>
    <p style="${P}">Thank you for your gift of <strong>${aud.format(opts.amount)}</strong> to Lighthouse Family Church. We&rsquo;re grateful for your faithfulness and generosity.</p>
    <p style="${P}">This email is your confirmation. Reference <strong>${opts.receiptNo}</strong>.</p>
    <p style="${P};margin-bottom:0;">With thanks and blessings,<br>Lighthouse Family Church</p>
  `)
  const text = `Hi ${firstName},\n\nThank you for your gift of ${aud.format(opts.amount)} to Lighthouse Family Church. We're grateful for your faithfulness and generosity.\n\nThis email is your confirmation. Reference ${opts.receiptNo}.\n\nWith thanks and blessings,\nLighthouse Family Church`
  await sendEmail({
    to: opts.to,
    from: CHURCH_FROM,
    subject: 'Thank you for your gift to Lighthouse Family Church',
    html,
    text,
  })
}

/**
 * Tithe account setup — from the church — invite a tither to set a password so
 * they can manage their giving.
 */
export async function sendTitheAccountSetupEmail(opts: {
  to: string
  name?: string | null
  token: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
  const firstName = opts.name?.trim().split(/\s+/)[0] || 'friend'
  const link = `${appUrl}/account/setup?token=${opts.token}`
  const html = wrapChurchEmailHtml(`
    <p style="${P}">Hi ${firstName},</p>
    <p style="${P}">Thank you again for your generosity. Would you like to manage your giving to Lighthouse Family Church online? Set a password and you&rsquo;ll be able to view and update your tithe any time.</p>
    <p style="margin:24px 0;"><a href="${link}" style="background:#f97316;color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Set up my account &rarr;</a></p>
    <p style="${P}">This link is valid for 14 days. There&rsquo;s no obligation — if you&rsquo;d rather not, simply ignore this email; your gift is already received.</p>
    <p style="${P};margin-bottom:0;">With thanks and blessings,<br>Lighthouse Family Church</p>
  `)
  const text = `Hi ${firstName},\n\nThank you again for your generosity. Set a password to manage your giving to Lighthouse Family Church online:\n${link}\n\n(Valid for 14 days. No obligation.)\n\nWith thanks and blessings,\nLighthouse Family Church`
  await sendEmail({ to: opts.to, from: CHURCH_FROM, subject: 'Manage your giving — Lighthouse Family Church', html, text })
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'weekly',
  fortnightly: 'fortnightly',
  monthly: 'monthly',
}

/**
 * Ask a migrated recurring donor (e.g. from Shout for Good) to re-confirm their
 * card via a tokenised link that pre-fills their gift. Uses the editable
 * DONOR_MIGRATION template.
 */
export async function sendDonorMigrationEmail(opts: {
  to: string
  name?: string | null
  amountCents: number
  frequency: string
  fundName?: string | null
  token: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
  const firstName = opts.name?.trim().split(/\s+/)[0] || 'friend'
  const link = `${appUrl}/give/resume/${opts.token}`
  const { subject, html, text } = await renderTemplate('DONOR_MIGRATION', {
    first_name: firstName,
    amount: aud.format(opts.amountCents / 100),
    frequency: FREQ_LABELS[opts.frequency] ?? opts.frequency,
    fund_name: opts.fundName ?? 'our work',
    resume_link: link,
    organisation_name: ORG.name,
  })
  await sendEmail({ to: opts.to, subject, html, text, templateType: 'DONOR_MIGRATION' })
}
