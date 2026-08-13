'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { companyKeyOf } from '@/lib/corporate'
import { resolveUserCompany } from '@/lib/corporate-server'

const CORPORATE_INBOX = 'volunteer@lighthousecare.org.au'

interface Result {
  success: boolean
  error?: string
}

/** The signed-in supporter's resolved company + identity (or null). */
async function myCompany(
  userId: string
): Promise<{ company: string; name: string | null; email: string } | null> {
  const r = await resolveUserCompany(userId)
  if (!r.company || !r.email) return null
  return { company: r.company, name: r.name, email: r.email }
}

// ─── Manually add a past corporate volunteering session ──────────────────────

const addSchema = z.object({
  date: z.string().optional().or(z.literal('')),
  timeLabel: z.string().trim().max(120).optional().or(z.literal('')),
  teamSize: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})
export type AddCorporateSessionInput = z.input<typeof addSchema>

export async function addCorporateSessionAction(input: AddCorporateSessionInput): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in again.' }

  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Please check the details.' }
  const { date, timeLabel, teamSize, notes } = parsed.data

  const mine = await myCompany(session.userId)
  if (!mine) return { success: false, error: 'We couldn’t find a company on your account.' }

  const d = date ? new Date(`${date}T00:00:00+10:00`) : null

  await prisma.corporateVolunteerSession.create({
    data: {
      companyName: mine.company,
      companyKey: companyKeyOf(mine.company),
      date: d && !Number.isNaN(d.getTime()) ? d : null,
      timeLabel: timeLabel || null,
      teamSize: teamSize || null,
      notes: notes || null,
      contactName: mine.name,
      contactEmail: mine.email,
      createdById: session.userId,
      source: 'Added by supporter',
    },
  })
  revalidatePath('/volunteer')
  return { success: true }
}

// ─── Request a corporate volunteer day (emails the team) ─────────────────────

const requestSchema = z.object({
  preferredDate: z.string().optional().or(z.literal('')),
  preferredTime: z.string().trim().max(120).optional().or(z.literal('')),
  teamSize: z.string().trim().max(120).optional().or(z.literal('')),
  message: z.string().trim().max(1500).optional().or(z.literal('')),
})
export type RequestCorporateDayInput = z.input<typeof requestSchema>

export async function requestCorporateDayAction(input: RequestCorporateDayInput): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in again.' }

  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Please check the details.' }
  const { preferredDate, preferredTime, teamSize, message } = parsed.data

  const mine = await myCompany(session.userId)
  if (!mine) return { success: false, error: 'We couldn’t find a company on your account.' }

  const P = 'margin:0 0 14px 0;line-height:1.6;color:#374151;font-size:15px;'
  const row = (label: string, value: string | null | undefined) =>
    `<tr><td style="padding:6px 12px;font-weight:600;color:#9a3412;width:130px;">${label}</td><td style="padding:6px 12px;color:#374151;">${value || '—'}</td></tr>`

  // Notify the team.
  await sendEmail({
    to: CORPORATE_INBOX,
    subject: `Corporate volunteer day request — ${mine.company}`,
    html: wrapEmailHtml(`
      <p style="${P}">A supporter has requested a corporate volunteer day. Please confirm or suggest an alternative.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;width:100%;margin:6px 0 16px;">
        ${row('Company', mine.company)}
        ${row('Contact', `${mine.name ?? ''} (${mine.email})`)}
        ${row('Preferred date', preferredDate)}
        ${row('Preferred time', preferredTime)}
        ${row('Team size', teamSize)}
        ${row('Message', message)}
      </table>
    `),
    text: `Corporate volunteer day request\n\nCompany: ${mine.company}\nContact: ${mine.name ?? ''} (${mine.email})\nPreferred date: ${preferredDate || '—'}\nPreferred time: ${preferredTime || '—'}\nTeam size: ${teamSize || '—'}\nMessage: ${message || '—'}`,
  })

  // Confirm to the requester.
  await sendEmail({
    to: mine.email,
    subject: 'We’ve got your corporate volunteer day request',
    html: wrapEmailHtml(`
      <p style="${P}">Hi ${mine.name?.split(' ')[0] ?? 'there'},</p>
      <p style="${P}">Thanks for wanting to bring the ${mine.company} team along to volunteer with Lighthouse Care. We’ve received your request and our team will be in touch shortly to confirm the details or suggest an alternative.</p>
      <p style="${P}"><strong>Preferred date:</strong> ${preferredDate || 'flexible'}<br><strong>Preferred time:</strong> ${preferredTime || 'flexible'}<br><strong>Team size:</strong> ${teamSize || 'to be confirmed'}</p>
      <p style="${P};margin-bottom:0;">With thanks,<br>The Lighthouse Care team</p>
    `),
    text: `Hi ${mine.name?.split(' ')[0] ?? 'there'},\n\nThanks for wanting to bring the ${mine.company} team to volunteer with Lighthouse Care. We've received your request and will be in touch shortly to confirm or suggest an alternative.\n\nPreferred date: ${preferredDate || 'flexible'}\nPreferred time: ${preferredTime || 'flexible'}\nTeam size: ${teamSize || 'to be confirmed'}\n\nWith thanks,\nThe Lighthouse Care team`,
  })

  return { success: true }
}
