import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { getCoordinatorEmail } from '@/lib/coordinators'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'

/**
 * After a volunteer signs out, thank them and ask for a one-tap rating.
 *
 * Each star is a plain link carrying an unguessable token, so it works in every
 * email client with no login — the lowest-friction thing that still can't be
 * used to rate on someone else's behalf.
 */
export async function sendShiftFeedbackEmail(opts: {
  volunteerId: string
  attendanceId: string
  durationLabel: string
}): Promise<void> {
  const vp = await prisma.volunteerProfile.findUnique({
    where: { id: opts.volunteerId },
    select: { firstName: true, email: true, preferredLocations: true, consentEmailUpdates: true },
  })
  if (!vp?.email) return

  // One feedback row per attendance record — never ask twice for the same shift.
  const existing = await prisma.shiftFeedback.findUnique({
    where: { attendanceId: opts.attendanceId },
    select: { id: true },
  })
  if (existing) return

  const token = crypto.randomBytes(24).toString('hex')
  await prisma.shiftFeedback.create({
    data: { token, volunteerId: opts.volunteerId, attendanceId: opts.attendanceId },
  })

  const star = (n: number) => {
    const url = `${APP_URL}/feedback/${token}?stars=${n}`
    return `<a href="${url}" style="display:inline-block;text-decoration:none;font-size:34px;line-height:1;padding:0 6px;color:#f59e0b;">&#9733;</a>`
  }

  const coordinator = await getCoordinatorEmail(vp.preferredLocations?.[0])

  await sendEmail({
    to: vp.email,
    volunteerId: opts.volunteerId, // reply-to resolves to their coordinator
    replyTo: coordinator,
    subject: `Thanks for volunteering today, ${vp.firstName}`,
    html: wrapEmailHtml(
      `
      <p style="${P}">Hi ${vp.firstName},</p>
      <p style="${P}">Thank you for giving <strong>${opts.durationLabel}</strong> of your time today — it genuinely makes a difference to families doing it tough.</p>
      <p style="${P}">How was today? Just tap a star — it takes one second.</p>
      <p style="margin:8px 0 6px 0;text-align:center;">${[1, 2, 3, 4, 5].map(star).join('')}</p>
      <p style="margin:0 0 22px 0;text-align:center;font-size:12px;color:#9ca3af;">Not great &nbsp;·&nbsp; Brilliant</p>
      <p style="${P}">If anything wasn&rsquo;t right, or you have an idea to make things better, just reply to this email — it goes straight to your volunteer coordinator.</p>
      <p style="${P};margin-bottom:0;">Thanks again,<br>The Lighthouse Care team</p>
    `,
      APP_URL
    ),
    text: `Hi ${vp.firstName},\n\nThank you for giving ${opts.durationLabel} of your time today.\n\nHow was today? Tap a rating:\n${[1, 2, 3, 4, 5]
      .map((n) => `${n} star${n > 1 ? 's' : ''}: ${APP_URL}/feedback/${token}?stars=${n}`)
      .join('\n')}\n\nIf anything wasn't right, just reply to this email — it goes to your volunteer coordinator.\n\nThanks again,\nThe Lighthouse Care team`,
  })
}
