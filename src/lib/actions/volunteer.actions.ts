'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'
import { profileUpdateSchema } from '@/lib/validations'

interface ActionResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

interface AvailabilityItem {
  dayOfWeek: string
  timePeriod: string  // 'PRE_OPEN' | 'MORNING' | 'AFTERNOON'
  startTime: string   // canonical "HH:MM" for the period
  endTime: string     // canonical "HH:MM" for the period
}

interface AvailabilityData {
  availability: AvailabilityItem[]
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireVolunteerSession(): Promise<{
  userId: string
  volunteerId: string
}> {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }
  if (!session.volunteerId) {
    throw new Error('No volunteer profile found for this account')
  }
  return { userId: session.userId, volunteerId: session.volunteerId }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDayEnum(day: string): string {
  return day.toUpperCase()
}

/** Derive TimePeriod enum value from a 24-hour startTime string */
function computeTimePeriod(startTime: string): string {
  if (startTime < '09:00') return 'PRE_OPEN'
  if (startTime < '12:30') return 'MORNING'
  return 'AFTERNOON'
}

// ─── Profile update ───────────────────────────────────────────────────────────

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  let volunteerId: string
  try {
    ;({ volunteerId } = await requireVolunteerSession())
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const raw = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    mobile: formData.get('mobile') as string,
    dateOfBirth: (formData.get('dateOfBirth') as string) || undefined,
    addressLine1: (formData.get('addressLine1') as string) || undefined,
    addressLine2: (formData.get('addressLine2') as string) || undefined,
    suburb: (formData.get('suburb') as string) || undefined,
    state: (formData.get('state') as string) || undefined,
    postcode: (formData.get('postcode') as string) || undefined,
    emergencyName: (formData.get('emergencyName') as string) || undefined,
    emergencyPhone: (formData.get('emergencyPhone') as string) || undefined,
    emergencyRelation: (formData.get('emergencyRelation') as string) || undefined,
    medicalNotes: (formData.get('medicalNotes') as string) || undefined,
    accessibilityNeeds: (formData.get('accessibilityNeeds') as string) || undefined,
    consentEmailUpdates:
      formData.get('consentEmailUpdates') === 'true' ||
      formData.get('consentEmailUpdates') === 'on',
    consentSmsUpdates:
      formData.get('consentSmsUpdates') === 'true' ||
      formData.get('consentSmsUpdates') === 'on',
  }

  const parsed = profileUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString()
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { success: false, error: 'Please fix the errors below', fieldErrors }
  }

  const data = parsed.data

  try {
    await prisma.volunteerProfile.update({
      where: { id: volunteerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        mobile: data.mobile,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        addressLine1: data.addressLine1 ?? null,
        addressLine2: data.addressLine2 ?? null,
        suburb: data.suburb ?? null,
        state: data.state ?? null,
        postcode: data.postcode ?? null,
        emergencyName: data.emergencyName ?? null,
        emergencyPhone: data.emergencyPhone ?? null,
        emergencyRelation: data.emergencyRelation ?? null,
        medicalNotes: data.medicalNotes ?? null,
        accessibilityNeeds: data.accessibilityNeeds ?? null,
        consentEmailUpdates: data.consentEmailUpdates ?? false,
        consentSmsUpdates: data.consentSmsUpdates ?? false,
      },
    })

    return { success: true }
  } catch (err) {
    console.error('[updateProfileAction]', err)
    return { success: false, error: 'Failed to update profile. Please try again.' }
  }
}

// ─── Availability update ──────────────────────────────────────────────────────

export async function updateAvailabilityAction(data: AvailabilityData): Promise<ActionResult> {
  let volunteerId: string
  try {
    ;({ volunteerId } = await requireVolunteerSession())
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    // Delete all existing availability and replace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await tx.volunteerAvailability.deleteMany({ where: { volunteerId } })

      if (data.availability.length > 0) {
        await tx.volunteerAvailability.createMany({
          data: data.availability.map((a) => ({
            volunteerId,
            dayOfWeek: toDayEnum(a.dayOfWeek) as never,
            timePeriod: a.timePeriod as never,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
          skipDuplicates: true,
        })
      }
    })

    return { success: true }
  } catch (err) {
    console.error('[updateAvailabilityAction]', err)
    return { success: false, error: 'Failed to update availability. Please try again.' }
  }
}

// ─── Induction section completion ─────────────────────────────────────────────

export async function completeInductionSectionAction(sectionId: string): Promise<ActionResult> {
  let volunteerId: string
  try {
    ;({ volunteerId } = await requireVolunteerSession())
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    await prisma.inductionProgress.upsert({
      where: { volunteerId_sectionId: { volunteerId, sectionId } },
      create: {
        volunteerId,
        sectionId,
        completed: true,
        completedAt: new Date(),
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
    })

    return { success: true }
  } catch (err) {
    console.error('[completeInductionSectionAction]', err)
    return { success: false, error: 'Failed to record section completion.' }
  }
}

// ─── Quiz submission ──────────────────────────────────────────────────────────

export async function submitQuizAnswersAction(
  answers: Record<string, string>
): Promise<ActionResult & { passed?: boolean; score?: number; total?: number }> {
  let volunteerId: string
  try {
    ;({ volunteerId } = await requireVolunteerSession())
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    // Load all active questions and their options
    const questions = await prisma.inductionQuizQuestion.findMany({
      where: { isActive: true },
      include: { options: true },
    })

    if (questions.length === 0) {
      return { success: false, error: 'No quiz questions found.' }
    }

    let correctCount = 0
    const answerRecords: Array<{
      volunteerId: string
      questionId: string
      optionId: string
      isCorrect: boolean
    }> = []

    for (const question of questions) {
      const selectedOptionId = answers[question.id]
      if (!selectedOptionId) continue

      const selectedOption = question.options.find((o) => o.id === selectedOptionId)
      const isCorrect = selectedOption?.isCorrect ?? false
      if (isCorrect) correctCount++

      answerRecords.push({
        volunteerId,
        questionId: question.id,
        optionId: selectedOptionId,
        isCorrect,
      })
    }

    // Upsert all answers
    for (const record of answerRecords) {
      await prisma.inductionQuizAnswer.upsert({
        where: {
          volunteerId_questionId: {
            volunteerId: record.volunteerId,
            questionId: record.questionId,
          },
        },
        create: record,
        update: { optionId: record.optionId, isCorrect: record.isCorrect },
      })
    }

    const passed = correctCount === questions.length

    if (passed) {
      // Promote directly to ACTIVE — no manual admin step needed
      const updated = await prisma.volunteerProfile.update({
        where: { id: volunteerId },
        data: { status: 'ACTIVE' },
        select: { firstName: true, lastName: true, email: true },
      })

      // Send INDUCTION_COMPLETE email
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
        const template = await renderTemplate('INDUCTION_COMPLETE', {
          first_name: updated.firstName,
          last_name: updated.lastName,
          portal_link: `${appUrl}/volunteer`,
        })
        await sendEmail({
          to: updated.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          templateType: 'INDUCTION_COMPLETE',
          volunteerId,
        })
      } catch (emailErr) {
        console.error('[submitQuizAnswersAction] induction email failed:', emailErr)
      }
    }

    return {
      success: true,
      passed,
      score: correctCount,
      total: questions.length,
    }
  } catch (err) {
    console.error('[submitQuizAnswersAction]', err)
    return { success: false, error: 'Failed to submit quiz answers. Please try again.' }
  }
}

// ─── Cannot attend notification ───────────────────────────────────────────────

export async function notifyCannotAttendAction(
  shiftAssignmentId: string,
  reason: string
): Promise<ActionResult> {
  let volunteerId: string
  try {
    ;({ volunteerId } = await requireVolunteerSession())
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    // Verify this assignment belongs to the current volunteer
    const assignment = await prisma.shiftAssignment.findFirst({
      where: { id: shiftAssignmentId, volunteerId },
    })

    if (!assignment) {
      return { success: false, error: 'Shift assignment not found.' }
    }

    if (assignment.status === 'CANCELLED_BY_VOLUNTEER' || assignment.status === 'ADMIN_CANCELLED') {
      return { success: false, error: 'This shift has already been cancelled.' }
    }

    await prisma.shiftAssignment.update({
      where: { id: shiftAssignmentId },
      data: {
        status: 'CANCELLED_BY_VOLUNTEER',
        cancelledAt: new Date(),
        cancelReason: reason || null,
      },
    })

    return { success: true }
  } catch (err) {
    console.error('[notifyCannotAttendAction]', err)
    return { success: false, error: 'Failed to update shift status. Please try again.' }
  }
}

// ─── Save induction answers (admin) ──────────────────────────────────────────

export async function saveInductionAnswersAction(
  volunteerId: string,
  answers: Record<string, string>
): Promise<ActionResult> {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Not authorised' }
  }

  try {
    await prisma.volunteerProfile.update({
      where: { id: volunteerId },
      data: { inductionAnswers: answers },
    })
    return { success: true }
  } catch (err) {
    console.error('[saveInductionAnswersAction]', err)
    return { success: false, error: 'Failed to save answers. Please try again.' }
  }
}

// ─── Message to admin ─────────────────────────────────────────────────────────

export async function submitMessageToAdminAction(message: string): Promise<ActionResult> {
  let volunteerId: string
  try {
    ;({ volunteerId } = await requireVolunteerSession())
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!message || message.trim().length === 0) {
    return { success: false, error: 'Message cannot be empty.' }
  }

  if (message.trim().length > 2000) {
    return { success: false, error: 'Message is too long (max 2000 characters).' }
  }

  try {
    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
      select: { firstName: true, lastName: true, email: true },
    })

    if (!volunteer) {
      return { success: false, error: 'Volunteer profile not found.' }
    }

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (!adminEmail) {
      console.warn('[submitMessageToAdminAction] ADMIN_NOTIFICATION_EMAIL not set')
      return { success: false, error: 'Could not send message. Please contact us directly.' }
    }

    await sendEmail({
      to: adminEmail,
      subject: `Message from volunteer: ${volunteer.firstName} ${volunteer.lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Message from Volunteer</h2>
          <p><strong>From:</strong> ${volunteer.firstName} ${volunteer.lastName} (${volunteer.email})</p>
          <p><strong>Message:</strong></p>
          <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; color: #374151;">
            ${message.replace(/\n/g, '<br>')}
          </blockquote>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/volunteers/${volunteerId}">View volunteer profile</a></p>
        </div>
      `,
      text: `Message from volunteer: ${volunteer.firstName} ${volunteer.lastName}\n\n${message}`,
      volunteerId,
    })

    return { success: true }
  } catch (err) {
    console.error('[submitMessageToAdminAction]', err)
    return { success: false, error: 'Failed to send message. Please try again.' }
  }
}

// ─── Volunteer self opt-out ───────────────────────────────────────────────────

export async function optOutAction(): Promise<ActionResult> {
  let volunteerId: string
  let userId: string
  try {
    ;({ volunteerId, userId } = await requireVolunteerSession())
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
      select: { firstName: true, lastName: true, email: true, status: true },
    })

    if (!volunteer) {
      return { success: false, error: 'Volunteer profile not found.' }
    }

    if (volunteer.status === 'REMOVED') {
      return { success: false, error: 'Your account is already removed.' }
    }

    // Mark as removed
    await prisma.volunteerProfile.update({
      where: { id: volunteerId },
      data: { status: 'REMOVED', deactivatedAt: new Date() },
    })

    // Add audit note
    await prisma.adminNote.create({
      data: {
        volunteerId,
        content: 'Volunteer opted out via the volunteer portal.',
        isInternal: true,
        createdById: userId,
      },
    })

    // Send farewell email
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
      const farewell = buildFarewellEmail(volunteer.firstName, appUrl)
      await sendEmail({
        to: volunteer.email,
        subject: farewell.subject,
        html: farewell.html,
        text: farewell.text,
        templateType: 'CUSTOM',
        volunteerId,
      })
    } catch (emailErr) {
      console.error('[optOutAction] farewell email failed:', emailErr)
    }

    return { success: true }
  } catch (err) {
    console.error('[optOutAction]', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
}

function buildFarewellEmail(firstName: string, appUrl: string) {
  const subject = `Thank you for everything, ${firstName} — from all of us at Lighthouse Care`
  const contactEmail = 'volunteer@lighthousecare.org.au'

  const html = `
<html><body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <img src="${appUrl}/logo-inline-black.png" alt="Lighthouse Care" style="height: 48px; object-fit: contain;" />
  </div>
  <h2 style="color: #f97316; font-size: 22px;">We're sad to see you go, ${firstName}</h2>
  <p>Hi ${firstName},</p>
  <p>
    We wanted to take a moment to say a heartfelt <strong>thank you</strong> for your time and dedication
    as a volunteer with Lighthouse Care. Every hour you gave made a real difference to the families
    and individuals in our community — and we are so grateful for your contribution.
  </p>
  <p>
    You'll always be part of the Lighthouse Care story, and we wish you all the very best in
    whatever comes next.
  </p>
  <p style="background: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; border-radius: 4px; margin: 24px 0;">
    <strong>Changed your mind?</strong> If you'd like to return as a volunteer, please email us at
    <a href="mailto:${contactEmail}" style="color: #f97316;">${contactEmail}</a>
    and we'd love to have you back.
  </p>
  <p>With gratitude,<br><strong>The Lighthouse Care Team</strong></p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
  <p style="font-size: 12px; color: #9ca3af; text-align: center;">
    Lighthouse Care — Making lives better so that together we can make the world better.<br />
    ABN 87 637 110 948 · Logan, South East Queensland
  </p>
</body></html>`

  const text = [
    `Thank you for everything, ${firstName} — from all of us at Lighthouse Care`,
    '',
    `Hi ${firstName},`,
    '',
    'Thank you for your time and dedication as a volunteer with Lighthouse Care. Every hour you gave made a real difference to families in our community.',
    '',
    `Changed your mind? Email us at ${contactEmail} — we'd love to have you back.`,
    '',
    'With gratitude,',
    'The Lighthouse Care Team',
  ].join('\n')

  return { subject, html, text }
}
