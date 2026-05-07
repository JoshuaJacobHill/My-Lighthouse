import prisma from '@/lib/prisma'
import type { EmailTemplateType } from '@prisma/client'
import { wrapEmailHtml } from '@/lib/email-html'

interface RenderedTemplate {
  subject: string
  html: string
  text: string
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const ORANGE = '#f97316'
const TEXT = '#374151'
const P = `margin:0 0 18px 0;line-height:1.7;color:${TEXT};font-size:15px;`
const BTN = `background:${ORANGE};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;`
const TABLE_CELL = `padding:8px 12px;font-size:14px;color:${TEXT};`

function btn(href: string, label: string) {
  return `<p style="margin:24px 0;"><a href="${href}" style="${BTN}">${label}</a></p>`
}

function shiftTable(vars: { shift_date?: string; shift_time?: string; location?: string } = {}) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;width:100%;margin:20px 0;">
      <tr><td style="${TABLE_CELL} font-weight:600;color:#9a3412;width:90px;">Date</td><td style="${TABLE_CELL}">${vars.shift_date ?? '{{shift_date}}'}</td></tr>
      <tr style="border-top:1px solid #fed7aa;"><td style="${TABLE_CELL} font-weight:600;color:#9a3412;">Time</td><td style="${TABLE_CELL}">${vars.shift_time ?? '{{shift_time}}'}</td></tr>
      <tr style="border-top:1px solid #fed7aa;"><td style="${TABLE_CELL} font-weight:600;color:#9a3412;">Location</td><td style="${TABLE_CELL}">${vars.location ?? '{{location}}'}</td></tr>
    </table>`
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://volunteers.lighthousecare.org.au'

function wrap(body: string) {
  return wrapEmailHtml(body, APP_URL)
}

// ─── Default hardcoded templates ─────────────────────────────────────────────

export const defaultTemplates: Record<
  EmailTemplateType,
  { subject: string; html: string; text: string }
> = {
  SIGNUP_CONFIRMATION: {
    subject: 'Welcome to Lighthouse Care Volunteers, {{first_name}}!',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">Thank you for registering as a volunteer with Lighthouse Care. We&rsquo;re so glad you&rsquo;ve decided to join our community — your time and care genuinely makes a difference to families across South East Queensland.</p>
      <p style="${P}">To get started, please complete your induction by visiting the volunteer portal. It only takes a short while and covers everything you need to know before your first shift.</p>
      ${btn('{{portal_link}}', 'Start My Induction &rarr;')}
      <p style="${P}">If you have any questions, don&rsquo;t hesitate to reach out — we&rsquo;re here to help.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Welcome to Lighthouse Care Volunteers, {{first_name}}!\n\nThank you for registering as a volunteer. We're so glad you've decided to join our community.\n\nTo get started, please complete your induction at: {{portal_link}}\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  INDUCTION_REMINDER: {
    subject: '{{first_name}}, your induction is still waiting for you',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">We noticed you haven&rsquo;t completed your volunteer induction yet. It only takes a short time and is an important step before your first shift.</p>
      <p style="${P}">Whenever you&rsquo;re ready, just head to the portal and pick up where you left off:</p>
      ${btn('{{portal_link}}', 'Complete My Induction &rarr;')}
      <p style="${P}">If you have any trouble accessing the portal or have questions, please reach out — we&rsquo;re happy to help get you sorted.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nYour volunteer induction is still waiting to be completed. Visit {{portal_link}} to finish up.\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  INDUCTION_COMPLETE: {
    subject: 'Congratulations {{first_name}} — you\'re ready to volunteer!',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">🎉 Congratulations — you&rsquo;ve completed your induction and you&rsquo;re now officially part of the Lighthouse Care volunteer family!</p>
      <p style="${P}">We can&rsquo;t wait to see you on your first shift. Head to the portal to browse upcoming shifts and book one that suits you:</p>
      ${btn('{{portal_link}}', 'View Upcoming Shifts &rarr;')}
      <p style="${P}">Thank you for giving your time to help make a real difference in people&rsquo;s lives. Every hour you give helps us provide hope, dignity, and practical support to families doing it tough.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nCongratulations — you've completed your induction and are now officially part of the Lighthouse Care volunteer family!\n\nHead to the portal to browse and book upcoming shifts: {{portal_link}}\n\nThank you for giving your time — it means the world.\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  SHIFT_REMINDER: {
    subject: 'Reminder: Your volunteer shift is coming up',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">Just a friendly reminder that you have a volunteer shift coming up:</p>
      ${shiftTable()}
      <p style="${P}">If you&rsquo;re unable to make it, please let us know as soon as possible through the volunteer portal so we can find a replacement.</p>
      ${btn('{{portal_link}}', 'Manage My Shifts &rarr;')}
      <p style="${P};margin-bottom:0;">Thank you for your commitment — we look forward to seeing you!<br><br>Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nReminder: You have a shift on {{shift_date}} at {{shift_time}} — {{location}}.\n\nIf you can't make it, please update your status at: {{portal_link}}\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  SHIFT_CANCELLED: {
    subject: 'Your volunteer shift has been cancelled',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">We wanted to let you know that the following shift has been cancelled:</p>
      ${shiftTable()}
      <p style="${P}">We&rsquo;re sorry for any inconvenience. Please check the portal for other available shifts — we&rsquo;d love to still see you soon.</p>
      ${btn('{{portal_link}}', 'View Available Shifts &rarr;')}
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nYour shift on {{shift_date}} at {{shift_time}} ({{location}}) has been cancelled.\n\nView other shifts at: {{portal_link}}\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  MISSED_SHIFT_FOLLOWUP: {
    subject: 'We missed you at your recent shift, {{first_name}}',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">We noticed you weren&rsquo;t able to make your shift on {{shift_date}} at {{location}}. We hope everything is okay!</p>
      <p style="${P}">No worries at all — life happens. We&rsquo;d love to see you at a future shift whenever you&rsquo;re ready.</p>
      ${btn('{{portal_link}}', 'View Upcoming Shifts &rarr;')}
      <p style="${P}">If you&rsquo;re having any difficulties or need to talk through your availability, please feel free to reach out to us directly at <a href="mailto:volunteer@lighthousecare.org.au" style="color:${ORANGE};text-decoration:underline;">volunteer@lighthousecare.org.au</a>.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nWe missed you at your shift on {{shift_date}} at {{location}}. Hope all is well!\n\nWe'd love to see you at a future shift. View upcoming shifts at: {{portal_link}}\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  INACTIVITY_CHECKIN: {
    subject: '{{first_name}}, we haven\'t seen you in a while — everything okay?',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">It&rsquo;s been a little while since we&rsquo;ve seen you volunteering with us, and we just wanted to check in.</p>
      <p style="${P}">If life has been busy or things have changed, we completely understand. Whenever you&rsquo;re ready to return — even for an occasional shift — we&rsquo;d love to have you back. Every hour you give genuinely matters to the families we support.</p>
      ${btn('{{portal_link}}', 'Return to the Portal &rarr;')}
      <p style="${P}">If you&rsquo;d like to take a break or update your volunteer status, you can do that through the portal too. And if you need to chat about anything, we&rsquo;re always just an email away.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nWe haven't seen you in a while and wanted to check in. Whenever you're ready to return, we'd love to have you back.\n\nVisit your portal at: {{portal_link}}\n\nIf you'd like to update your volunteer status or take a break, you can do that through the portal too.\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  ADMIN_NEW_VOLUNTEER: {
    subject: 'New volunteer registration — {{first_name}} {{last_name}}',
    html: wrap(`
      <p style="${P}">A new volunteer has registered and is awaiting induction:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;width:100%;margin:16px 0 24px;">
        <tr><td style="padding:12px 16px;font-size:15px;color:${TEXT};"><strong>{{first_name}} {{last_name}}</strong></td></tr>
      </table>
      ${btn('{{portal_link}}', 'View in Admin Portal &rarr;')}
    `),
    text: `New volunteer registration: {{first_name}} {{last_name}}\n\nView in admin portal: {{portal_link}}`,
  },

  ADMIN_REPEATED_NOSHOWS: {
    subject: 'Alert: Repeated no-shows — {{first_name}} {{last_name}}',
    html: wrap(`
      <p style="${P}">Volunteer <strong>{{first_name}} {{last_name}}</strong> has had repeated no-shows and may require a follow-up.</p>
      <p style="${P}">Please review their profile and reach out if appropriate.</p>
      ${btn('{{portal_link}}', 'View Volunteer Profile &rarr;')}
    `),
    text: `Alert: {{first_name}} {{last_name}} has had repeated no-shows.\n\nView profile: {{portal_link}}`,
  },

  CUSTOM: {
    subject: 'Message from {{organisation_name}}',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">You have a message from {{organisation_name}}.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nYou have a message from {{organisation_name}}.\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },
}

// ─── Template renderer ────────────────────────────────────────────────────────

function replacePlaceholders(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match
  })
}

export async function renderTemplate(
  templateType: string,
  variables: Record<string, string>
): Promise<RenderedTemplate> {
  const mergedVars: Record<string, string> = {
    organisation_name: 'Lighthouse Care',
    portal_link: process.env.NEXT_PUBLIC_APP_URL ?? 'https://volunteers.lighthousecare.org.au',
    ...variables,
  }

  // Try DB first
  try {
    const dbTemplate = await prisma.emailTemplate.findUnique({
      where: { type: templateType as EmailTemplateType },
    })

    if (dbTemplate && dbTemplate.isActive) {
      return {
        subject: replacePlaceholders(dbTemplate.subject, mergedVars),
        html: replacePlaceholders(dbTemplate.bodyHtml, mergedVars),
        text: replacePlaceholders(dbTemplate.bodyText ?? '', mergedVars),
      }
    }
  } catch {
    // DB lookup failed — fall through to defaults
  }

  // Fall back to hardcoded defaults
  const fallback = defaultTemplates[templateType as EmailTemplateType]
  if (!fallback) {
    return {
      subject: replacePlaceholders('Message from {{organisation_name}}', mergedVars),
      html: replacePlaceholders(wrapEmailHtml('<p>Hi {{first_name}},</p><p>You have a message from {{organisation_name}}.</p>', APP_URL), mergedVars),
      text: replacePlaceholders('Hi {{first_name}},\n\nYou have a message from {{organisation_name}}.', mergedVars),
    }
  }

  return {
    subject: replacePlaceholders(fallback.subject, mergedVars),
    html: replacePlaceholders(fallback.html, mergedVars),
    text: replacePlaceholders(fallback.text, mergedVars),
  }
}
