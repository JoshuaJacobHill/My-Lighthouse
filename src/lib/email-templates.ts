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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'

function wrap(body: string) {
  return wrapEmailHtml(body, APP_URL)
}

// ─── Default hardcoded templates ─────────────────────────────────────────────

export const defaultTemplates: Record<
  EmailTemplateType,
  { subject: string; html: string; text: string }
> = {
  SIGNUP_CONFIRMATION: {
    subject: 'Thank you for signing up, {{first_name}} — your visit is confirmed!',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">Thank you so much for signing up to volunteer with Lighthouse Care! We&rsquo;re really glad you&rsquo;re joining us — your time genuinely makes a difference to families doing it tough across South East Queensland.</p>
      <p style="${P}">Your <strong>volunteer induction appointment</strong> is confirmed for:</p>
      ${shiftTable()}
      <p style="${P}">Your volunteer induction is a chance to meet the Lighthouse Care team, learn more about who we are and the work we do, and get everything ready for you to begin volunteering.</p>
      <p style="${P}">During the appointment, we&rsquo;ll walk you through our volunteer opportunities, workplace expectations, safety procedures and answer any questions you may have. We&rsquo;ll also discuss where your skills, interests and availability might best fit within Lighthouse Care.</p>
      <p style="${P}"><strong>When you arrive, ask to speak with the volunteer coordinator.</strong></p>
      <p style="${P}">We&rsquo;ve attached a calendar invite to help you remember. If this time doesn&rsquo;t suit you, our volunteer coordinator will be in touch to arrange a revised time — so no need to worry if something comes up.</p>
      <p style="${P}">In the meantime, you can get a head start by completing your online induction through the volunteer portal. It only takes 15–20 minutes and covers everything you need to know before your first shift.</p>
      ${btn('{{portal_link}}', 'Start My Induction &rarr;')}
      <p style="${P}">If you have any questions at all, don&rsquo;t hesitate to reach out — we&rsquo;re here to help.</p>
      <p style="${P};margin-bottom:0;">We look forward to meeting you!<br><br>Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nThank you so much for signing up to volunteer with Lighthouse Care! We're really glad you're joining us.\n\nYour volunteer induction appointment is confirmed for:\nDate: {{shift_date}}\nTime: {{shift_time}}\nLocation: {{location}}\n\nYour volunteer induction is a chance to meet the Lighthouse Care team, learn more about who we are and the work we do, and get everything ready for you to begin volunteering.\n\nDuring the appointment, we'll walk you through our volunteer opportunities, workplace expectations, safety procedures and answer any questions you may have. We'll also discuss where your skills, interests and availability might best fit within Lighthouse Care.\n\nWhen you arrive, ask to speak with the volunteer coordinator.\n\nWe've attached a calendar invite to help you remember. If this time doesn't suit you, our volunteer coordinator will be in touch to arrange a revised time.\n\nIn the meantime, you can complete your online induction at: {{portal_link}}\n\nWe look forward to meeting you!\n\nWarm regards,\nThe {{organisation_name}} Team`,
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

  VOLUNTEER_WELCOME: {
    subject: 'Your Lighthouse Care volunteer account is ready, {{first_name}}!',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">We&rsquo;re excited to let you know that Lighthouse Care has launched a brand new volunteer portal — and we&rsquo;ve already set up an account for you!</p>
      <p style="${P}">The portal is your one-stop place to manage your volunteering with us. Here&rsquo;s what you can do:</p>
      <ul style="margin:0 0 18px 0;padding-left:20px;color:#374151;font-size:15px;line-height:2;">
        <li>Browse and book upcoming volunteer shifts</li>
        <li>Track your volunteer hours</li>
        <li>Complete your online induction and training</li>
        <li>Stay in the loop with updates from the team</li>
      </ul>
      <p style="${P}">To get started, just tap the button below to create your password and activate your account. This link is valid for <strong>7 days</strong>.</p>
      ${btn('{{set_password_link}}', 'Activate My Account &rarr;')}
      <p style="${P}">If you have any questions or need a hand getting set up, don&rsquo;t hesitate to reach out — we&rsquo;re always happy to help.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nWe're excited to let you know that Lighthouse Care has launched a brand new volunteer portal — and we've already set up an account for you!\n\nThe portal is your one-stop place to manage your volunteering with us:\n- Browse and book upcoming volunteer shifts\n- Track your volunteer hours\n- Complete your online induction and training\n- Stay in the loop with updates from the team\n\nTo get started, create your password here to activate your account (link valid for 7 days):\n{{set_password_link}}\n\nIf you have any questions or need a hand getting set up, don't hesitate to reach out.\n\nWarm regards,\nThe {{organisation_name}} Team`,
  },

  SHIFT_BOOKED: {
    subject: "You're booked in, {{first_name}}!",
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">Great news — your shift is confirmed. Here are the details:</p>
      ${shiftTable()}
      <p style="${P}">{{recurring_note}}</p>
      <p style="${P}">If you need to cancel or can&rsquo;t make it, please let us know as soon as possible through the volunteer portal so we can plan ahead.</p>
      ${btn('{{portal_link}}', 'Manage My Shifts &rarr;')}
      <p style="${P};margin-bottom:0;">Thanks for giving your time — we&rsquo;ll see you then!<br><br>Warm regards,<br>The {{organisation_name}} Team</p>
    `),
    text: `Hi {{first_name}},\n\nYour shift is confirmed!\n\nDate: {{shift_date}}\nTime: {{shift_time}}\nLocation: {{location}}\n\n{{recurring_note}}\n\nIf you need to cancel, please update your shifts at: {{portal_link}}\n\nThanks for giving your time — we'll see you then!\n\nWarm regards,\nThe {{organisation_name}} Team`,
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

  // ─── Donor portal emails ────────────────────────────────────────────────
  DONATION_RECEIPT: {
    subject: 'Thank you for your gift to {{organisation_name}}',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">Thank you for your gift of <strong>{{amount}}</strong> to {{fund_name}}. Because of you, families doing it tough across South East Queensland have a little more hope this week.</p>
      <p style="${P}">This email is your receipt. Receipt number <strong>{{receipt_no}}</strong>, issued by {{organisation_name}} (ABN {{abn}}).</p>
      ${btn('{{portal_link}}/donor', 'View my giving &rarr;')}
      <p style="${P};margin-bottom:0;">With heartfelt thanks,<br>The {{organisation_name}} team</p>
    `),
    text: `Hi {{first_name}},\n\nThank you for your gift of {{amount}} to {{fund_name}}.\n\nThis email is your receipt. Receipt number {{receipt_no}}, issued by {{organisation_name}} (ABN {{abn}}).\n\nView your giving: {{portal_link}}/donor\n\nWith heartfelt thanks,\nThe {{organisation_name}} team`,
  },

  DONOR_ACCOUNT_SETUP: {
    subject: 'Welcome to the My Lighthouse Portal — activate your account',
    html: wrap(`
      <div style="margin:-36px -40px 28px -40px;">
        <img src="https://lighthousecare.org.au/wp-content/uploads/2026/08/Introducing-MyLighthouse-Banner.jpg" alt="Introducing the My Lighthouse Portal" width="600" style="display:block;width:100%;height:auto;border:0;" />
      </div>
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">Thank you for supporting {{organisation_name}}.</p>
      <p style="${P}">Every person who gives, volunteers, shows up at an event, supports an appeal or simply tells someone about what we do becomes part of something much bigger — a community of people helping make life a little easier for families when they need it most.</p>
      <p style="${P}">That&rsquo;s why we&rsquo;ve created the <strong>My Lighthouse Portal</strong> — a new online home for our supporters. It&rsquo;s a place where you can see your connection with {{organisation_name}}, discover new ways to get involved and stay close to the impact you&rsquo;re helping make.</p>
      <p style="${P}">Inside the portal, you&rsquo;ll be able to:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 20px 0;">
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">View your giving history and download tax-deductible receipts</td></tr>
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">Manage your regular giving and securely update your details</td></tr>
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">Find one-off and regular volunteering opportunities</td></tr>
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">Register to help with special moments like our Christmas Blitz, Good Food Festival and other community events</td></tr>
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">Discover corporate volunteering days for your workplace or team</td></tr>
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">Get involved with appeals like Santa&rsquo;s Little Helpers, Disaster Relief and emergency food relief</td></tr>
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">Keep track of your volunteering and support</td></tr>
        <tr><td style="width:26px;padding:6px 0;color:${ORANGE};font-weight:bold;font-size:16px;vertical-align:top;">&#10003;</td><td style="padding:6px 0;font-size:15px;line-height:1.5;color:${TEXT};">Hear about new opportunities to help throughout the year</td></tr>
      </table>
      <p style="${P}">We&rsquo;ve already loaded your recent giving history into the portal — it&rsquo;s ready and waiting. All you need to do is create a password to unlock your My Lighthouse dashboard.</p>
      <p style="${P}">It only takes a minute to activate your account.</p>
      ${btn('{{set_password_link}}', 'Activate my My Lighthouse Portal account &rarr;')}
      <p style="${P}">Your activation link is valid for 14 days.</p>
      <p style="${P}">However you choose to be involved, we want you to know how much it means to us. {{organisation_name}} has always been built around people helping people, and we&rsquo;re incredibly grateful that you&rsquo;re part of that story.</p>
      <p style="${P}">Together, we get to put food on tables, bring hope in difficult moments and remind people that their community is behind them.</p>
      <p style="${P}">Thank you for helping us make lives better, so that together we can make the world better.</p>
      <p style="${P};margin-bottom:0;">With heartfelt thanks,<br>The {{organisation_name}} team</p>
    `),
    text: `Hi {{first_name}},\n\nThank you for supporting {{organisation_name}}.\n\nEvery person who gives, volunteers, shows up at an event, supports an appeal or simply tells someone about what we do becomes part of something much bigger — a community of people helping make life a little easier for families when they need it most.\n\nThat's why we've created the My Lighthouse Portal — a new online home for our supporters. It's a place where you can see your connection with {{organisation_name}}, discover new ways to get involved and stay close to the impact you're helping make.\n\nInside the portal, you'll be able to:\n- View your giving history and download tax-deductible receipts\n- Manage your regular giving and securely update your details\n- Find one-off and regular volunteering opportunities\n- Register to help with special moments like our Christmas Blitz, Good Food Festival and other community events\n- Discover corporate volunteering days for your workplace or team\n- Get involved with appeals like Santa's Little Helpers, Disaster Relief and emergency food relief\n- Keep track of your volunteering and support\n- Hear about new opportunities to help throughout the year\n\nWe've already loaded your recent giving history into the portal — it's ready and waiting. All you need to do is create a password to unlock your My Lighthouse dashboard.\n\nIt only takes a minute to activate your account:\n{{set_password_link}}\n\nYour activation link is valid for 14 days.\n\nHowever you choose to be involved, we want you to know how much it means to us. {{organisation_name}} has always been built around people helping people, and we're incredibly grateful that you're part of that story.\n\nTogether, we get to put food on tables, bring hope in difficult moments and remind people that their community is behind them.\n\nThank you for helping us make lives better, so that together we can make the world better.\n\nWith heartfelt thanks,\nThe {{organisation_name}} team`,
  },

  TICKET_CONFIRMATION: {
    subject: 'Your tickets — {{event_name}}',
    html: wrap(`
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">You&rsquo;re registered for <strong>{{event_name}}</strong>. Please bring your reference code(s) with you.</p>
      <p style="${P}"><strong>When:</strong> {{when}}<br>{{where}}{{paid}}</p>
      {{tickets}}
      <p style="${P}">We can&rsquo;t wait to see you there.</p>
      <p style="${P};margin-bottom:0;">Warm regards,<br>The {{organisation_name}} team</p>
    `),
    text: `Hi {{first_name}},\n\nYou're registered for {{event_name}}.\n\nWhen: {{when}}\n\nYour ticket reference(s) are shown in this confirmation. We can't wait to see you there.\n\nWarm regards,\nThe {{organisation_name}} team`,
  },

  DONOR_MIGRATION: {
    subject: 'Your giving is paused — please update your payment details',
    html: wrap(`
      <p style="margin:0 0 18px 0;"><span style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:999px;padding:5px 14px;font-size:13px;font-weight:700;">&#9208; Giving paused</span></p>
      <p style="${P}">Hi {{first_name}},</p>
      <p style="${P}">Thank you for being one of our regular givers. Your giving is currently <strong>paused</strong> — we&rsquo;ve moved to a new home for managing giving, and for your security card details couldn&rsquo;t come across with us. To restart your support, please take a moment to update your payment details below. It only takes about a minute.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;width:100%;margin:20px 0;">
        <tr><td style="${TABLE_CELL} font-weight:600;color:#9a3412;width:110px;">Your gift</td><td style="${TABLE_CELL}">{{amount}} {{frequency}}</td></tr>
        <tr style="border-top:1px solid #fed7aa;"><td style="${TABLE_CELL} font-weight:600;color:#9a3412;">Supporting</td><td style="${TABLE_CELL}">{{fund_name}}</td></tr>
      </table>
      <p style="${P}">Everything is filled in for you — you can adjust the amount if you&rsquo;d like, or simply confirm your card to pick up right where you left off.</p>
      ${btn('{{resume_link}}', 'Update my details &amp; resume giving &rarr;')}
      <p style="${P}">Once that&rsquo;s done, we&rsquo;ll send you a separate email to set a password so you can manage your giving any time. This link is valid for 60 days.</p>
      <p style="${P}">Your generosity means a full trolley of essentials for a family doing it tough — thank you for continuing to make lives better.</p>
      <p style="${P}">If you have any questions, just email <a href="mailto:accounts@lighthousecare.org.au" style="color:${ORANGE};font-weight:600;text-decoration:none;">accounts@lighthousecare.org.au</a> and we&rsquo;ll be glad to help.</p>
      <p style="${P};margin-bottom:0;">With heartfelt thanks,<br>The {{organisation_name}} team</p>
    `),
    text: `Hi {{first_name}},\n\n[ GIVING PAUSED ]\n\nThank you for being one of our regular givers. Your giving is currently paused — we've moved to a new home for managing giving, and for your security card details couldn't come across with us. To restart your support, please take a moment to update your payment details. It only takes about a minute.\n\nYour gift: {{amount}} {{frequency}}\nSupporting: {{fund_name}}\n\nEverything is filled in for you — you can adjust the amount if you'd like, or simply confirm your card:\n{{resume_link}}\n\nOnce that's done, we'll send you a separate email to set a password so you can manage your giving any time. (Link valid for 60 days.)\n\nIf you have any questions, just email accounts@lighthousecare.org.au and we'll be glad to help.\n\nWith heartfelt thanks,\nThe {{organisation_name}} team`,
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
    portal_link: process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au',
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
