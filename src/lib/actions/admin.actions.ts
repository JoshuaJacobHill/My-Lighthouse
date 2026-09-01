'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession, createPasswordResetToken } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'
import { wrapEmailHtml } from '@/lib/email-html'
import { formatDate } from '@/lib/utils'
import type { VolunteerStatus, UserRole } from '@prisma/client'
import { isAdminRole } from '@/lib/permissions-core'
import { assertCapability } from '@/lib/permissions'
import type { Capability } from '@/lib/permissions-core'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'

interface ActionResult {
  success: boolean
  error?: string
  data?: unknown
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdminSession(): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }
  await assertCapability('care.people')
  return { userId: session.userId, role: session.role }
}

// ─── Volunteer status update ──────────────────────────────────────────────────

export async function updateVolunteerStatusAction(
  volunteerId: string,
  status: string
): Promise<ActionResult> {
  let adminSession: { userId: string; role: string }
  try {
    adminSession = await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const validStatuses: VolunteerStatus[] = [
    'PENDING_INDUCTION',
    'ACTIVE',
    'INACTIVE',
    'ON_LEAVE',
    'SUSPENDED',
    'REMOVED',
  ]

  if (!validStatuses.includes(status as VolunteerStatus)) {
    return { success: false, error: `Invalid status: ${status}` }
  }

  try {
    // Fetch current status before updating so we know if this is a new removal
    const current = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
      select: { status: true, firstName: true, lastName: true, email: true },
    })

    const updated = await prisma.volunteerProfile.update({
      where: { id: volunteerId },
      data: {
        status: status as VolunteerStatus,
        deactivatedAt:
          status === 'REMOVED' || status === 'INACTIVE' || status === 'SUSPENDED' ? new Date() : undefined,
      },
    })

    // Add an audit note
    await prisma.adminNote.create({
      data: {
        volunteerId,
        content: `Status changed to ${status} by admin.`,
        isInternal: true,
        createdById: adminSession.userId,
      },
    })

    // ── Send farewell email when a volunteer is newly marked as REMOVED ───
    if (status === 'REMOVED' && current?.status !== 'REMOVED' && current) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
      const farewell = buildFarewellEmail(current.firstName, appUrl)
      try {
        await sendEmail({
          to: current.email,
          subject: farewell.subject,
          html: farewell.html,
          text: farewell.text,
          templateType: 'CUSTOM',
          volunteerId,
        })
      } catch (emailErr) {
        // Don't fail the status update if the email fails
        console.error('[updateVolunteerStatusAction] farewell email failed:', emailErr)
      }
    }

    return { success: true, data: { status: updated.status } }
  } catch (err) {
    console.error('[updateVolunteerStatusAction]', err)
    return { success: false, error: 'Failed to update volunteer status.' }
  }
}

// ─── Farewell email template ──────────────────────────────────────────────────

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
    <strong>Made a mistake?</strong> If this removal was made in error and you'd like to be
    reinstated as a volunteer, please email us at
    <a href="mailto:${contactEmail}" style="color: #f97316;">${contactEmail}</a>
    and we'll get it sorted.
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
    'We wanted to take a moment to say a heartfelt thank you for your time and dedication as a volunteer with Lighthouse Care. Every hour you gave made a real difference to the families and individuals in our community — and we are so grateful for your contribution.',
    '',
    'You\'ll always be part of the Lighthouse Care story, and we wish you all the very best in whatever comes next.',
    '',
    `Made a mistake? If this removal was made in error and you'd like to be reinstated as a volunteer, please email us at ${contactEmail} and we'll get it sorted.`,
    '',
    'With gratitude,',
    'The Lighthouse Care Team',
  ].join('\n')

  return { subject, html, text }
}

// ─── Admin notes ──────────────────────────────────────────────────────────────

export async function addAdminNoteAction(
  volunteerId: string,
  content: string
): Promise<ActionResult> {
  let adminSession: { userId: string; role: string }
  try {
    adminSession = await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Note content cannot be empty.' }
  }

  try {
    const note = await prisma.adminNote.create({
      data: {
        volunteerId,
        content: content.trim(),
        isInternal: true,
        createdById: adminSession.userId,
      },
    })

    return { success: true, data: note }
  } catch (err) {
    console.error('[addAdminNoteAction]', err)
    return { success: false, error: 'Failed to create note.' }
  }
}

// ─── Send email to volunteer ──────────────────────────────────────────────────

export async function sendEmailToVolunteerAction(
  volunteerId: string,
  subject: string,
  html: string
): Promise<ActionResult> {
  let adminSession: { userId: string; role: string }
  try {
    adminSession = await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!subject || !html) {
    return { success: false, error: 'Subject and message are required.' }
  }

  try {
    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
      select: { email: true, firstName: true, lastName: true, status: true },
    })

    if (!volunteer) {
      return { success: false, error: 'Volunteer not found.' }
    }

    if (volunteer.status === 'REMOVED') {
      return { success: false, error: 'Emails cannot be sent to removed volunteers.' }
    }

    const result = await sendEmail({
      to: volunteer.email,
      subject,
      html,
      templateType: 'CUSTOM',
      volunteerId,
    })

    if (!result.success) {
      return { success: false, error: result.error ?? 'Failed to send email.' }
    }

    // Audit note
    await prisma.adminNote.create({
      data: {
        volunteerId,
        content: `Email sent with subject: "${subject}"`,
        isInternal: true,
        createdById: adminSession.userId,
      },
    })

    return { success: true }
  } catch (err) {
    console.error('[sendEmailToVolunteerAction]', err)
    return { success: false, error: 'Failed to send email.' }
  }
}

// ─── Manual sign-out ──────────────────────────────────────────────────────────

export async function manualSignOutAction(attendanceId: string): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceId },
    })

    if (!record) {
      return { success: false, error: 'Attendance record not found.' }
    }

    if (record.signOutAt) {
      return { success: false, error: 'Volunteer has already been signed out.' }
    }

    const signOutAt = new Date()
    const durationMins = Math.round(
      (signOutAt.getTime() - record.signInAt.getTime()) / 1000 / 60
    )

    const updated = await prisma.attendanceRecord.update({
      where: { id: attendanceId },
      data: {
        signOutAt,
        durationMins,
        notes: record.notes
          ? `${record.notes} [Manual sign-out by admin]`
          : '[Manual sign-out by admin]',
      },
    })

    // Update volunteer's last active timestamp
    await prisma.volunteerProfile.update({
      where: { id: record.volunteerId },
      data: { lastAttendedAt: signOutAt, lastActiveAt: signOutAt },
    })

    return { success: true, data: { durationMins: updated.durationMins } }
  } catch (err) {
    console.error('[manualSignOutAction]', err)
    return { success: false, error: 'Failed to sign out volunteer.' }
  }
}

// ─── Create volunteer ─────────────────────────────────────────────────────────

interface CreateVolunteerData {
  firstName: string
  lastName: string
  email: string
  mobile: string
  dateOfBirth?: string
  addressLine1?: string
  addressLine2?: string
  suburb?: string
  state?: string
  postcode?: string
  emergencyName?: string
  emergencyPhone?: string
  emergencyRelation?: string
  status?: string
  notes?: string
  preferredLocations?: string[]
  areasOfInterest?: string[]
}

export async function createVolunteerAction(
  data: CreateVolunteerData
): Promise<{ success: boolean; volunteerId?: string; error?: string }> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!data.firstName || !data.lastName || !data.email || !data.mobile) {
    return { success: false, error: 'First name, last name, email and mobile are required.' }
  }

  try {
    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return { success: false, error: 'A user with this email address already exists.' }
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        role: 'VOLUNTEER',
        volunteerProfile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            mobile: data.mobile,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            addressLine1: data.addressLine1 || undefined,
            addressLine2: data.addressLine2 || undefined,
            suburb: data.suburb || undefined,
            state: data.state || undefined,
            postcode: data.postcode || undefined,
            emergencyName: data.emergencyName || undefined,
            emergencyPhone: data.emergencyPhone || undefined,
            emergencyRelation: data.emergencyRelation || undefined,
            status: (data.status as VolunteerStatus) ?? 'PENDING_INDUCTION',
            notes: data.notes || undefined,
            preferredLocations: data.preferredLocations ?? [],
            areasOfInterest: data.areasOfInterest ?? [],
          },
        },
      },
      include: { volunteerProfile: true },
    })

    return { success: true, volunteerId: user.volunteerProfile?.id }
  } catch (err) {
    console.error('[createVolunteerAction]', err)
    return { success: false, error: 'Failed to create volunteer. Please try again.' }
  }
}

// ─── Manual guest sign-out ────────────────────────────────────────────────────

export async function manualGuestSignOutAction(guestId: string): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const record = await prisma.guestAttendanceRecord.findUnique({ where: { id: guestId } })
    if (!record) return { success: false, error: 'Guest record not found.' }
    if (record.signOutAt) return { success: false, error: 'Guest has already been signed out.' }

    const signOutAt = new Date()
    const durationMins = Math.round(
      (signOutAt.getTime() - record.signInAt.getTime()) / 1000 / 60
    )

    await prisma.guestAttendanceRecord.update({
      where: { id: guestId },
      data: { signOutAt, durationMins },
    })

    return { success: true, data: { durationMins } }
  } catch (err) {
    console.error('[manualGuestSignOutAction]', err)
    return { success: false, error: 'Failed to sign out guest.' }
  }
}

// ─── Induction sections ───────────────────────────────────────────────────────

interface InductionSectionData {
  title: string
  content: string
  sortOrder: number
  isRequired: boolean
  isActive: boolean
}

export async function updateInductionSectionAction(
  id: string | null,
  data: InductionSectionData
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!data.title || !data.title.trim()) {
    return { success: false, error: 'Title is required.' }
  }
  if (!data.content || !data.content.trim()) {
    return { success: false, error: 'Content is required.' }
  }

  try {
    let section
    if (id) {
      section = await prisma.inductionSection.update({
        where: { id },
        data: {
          title: data.title.trim(),
          content: data.content.trim(),
          sortOrder: data.sortOrder,
          isRequired: data.isRequired,
          isActive: data.isActive,
        },
      })
    } else {
      section = await prisma.inductionSection.create({
        data: {
          title: data.title.trim(),
          content: data.content.trim(),
          sortOrder: data.sortOrder,
          isRequired: data.isRequired,
          isActive: data.isActive,
        },
      })
    }
    return { success: true, data: section }
  } catch (err) {
    console.error('[updateInductionSectionAction]', err)
    return { success: false, error: 'Failed to save induction section.' }
  }
}

export async function deleteInductionSectionAction(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    await prisma.inductionSection.delete({ where: { id } })
    return { success: true }
  } catch (err) {
    console.error('[deleteInductionSectionAction]', err)
    return { success: false, error: 'Failed to delete induction section.' }
  }
}

// ─── Quiz questions ───────────────────────────────────────────────────────────

interface QuizOptionData {
  id?: string
  optionText: string
  isCorrect: boolean
  sortOrder?: number
}

interface QuizQuestionData {
  question: string
  sortOrder: number
  options: QuizOptionData[]
}

export async function updateQuizQuestionAction(
  id: string | null,
  data: QuizQuestionData
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!data.question || !data.question.trim()) {
    return { success: false, error: 'Question text is required.' }
  }
  if (!data.options || data.options.length < 2) {
    return { success: false, error: 'At least two options are required.' }
  }
  if (!data.options.some(o => o.isCorrect)) {
    return { success: false, error: 'At least one option must be marked as correct.' }
  }

  try {
    let question
    if (id) {
      // Delete all existing options then recreate (simplest approach for replacing)
      await prisma.inductionQuizOption.deleteMany({ where: { questionId: id } })
      question = await prisma.inductionQuizQuestion.update({
        where: { id },
        data: {
          question: data.question.trim(),
          sortOrder: data.sortOrder,
          options: {
            create: data.options.map((o, i) => ({
              optionText: o.optionText.trim(),
              isCorrect: o.isCorrect,
              sortOrder: o.sortOrder ?? i,
            })),
          },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      })
    } else {
      question = await prisma.inductionQuizQuestion.create({
        data: {
          question: data.question.trim(),
          sortOrder: data.sortOrder,
          options: {
            create: data.options.map((o, i) => ({
              optionText: o.optionText.trim(),
              isCorrect: o.isCorrect,
              sortOrder: o.sortOrder ?? i,
            })),
          },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      })
    }
    return { success: true, data: question }
  } catch (err) {
    console.error('[updateQuizQuestionAction]', err)
    return { success: false, error: 'Failed to save quiz question.' }
  }
}

export async function deleteQuizQuestionAction(id: string): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    await prisma.inductionQuizQuestion.delete({ where: { id } })
    return { success: true }
  } catch (err) {
    console.error('[deleteQuizQuestionAction]', err)
    return { success: false, error: 'Failed to delete quiz question.' }
  }
}

// ─── Admin availability update ───────────────────────────────────────────────

export async function adminUpdateAvailabilityAction(
  volunteerId: string,
  data: { availability: Array<{ dayOfWeek: string; timePeriod: string; startTime: string; endTime: string }> }
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await tx.volunteerAvailability.deleteMany({ where: { volunteerId } })

      if (data.availability.length > 0) {
        await tx.volunteerAvailability.createMany({
          data: data.availability.map((a) => ({
            volunteerId,
            dayOfWeek: a.dayOfWeek as never,
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
    console.error('[adminUpdateAvailabilityAction]', err)
    return { success: false, error: 'Failed to update availability. Please try again.' }
  }
}

// ─── Export volunteers CSV ────────────────────────────────────────────────────

export async function exportVolunteersCSVAction(): Promise<{
  success: boolean
  csv?: string
  error?: string
}> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const volunteers = await prisma.volunteerProfile.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        availability: true,
        attendanceRecords: {
          select: { durationMins: true },
        },
      },
    })

    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Mobile',
      'Status',
      'Suburb',
      'State',
      'Postcode',
      'Date of Birth',
      'Emergency Contact',
      'Emergency Phone',
      'Preferred Locations',
      'Areas of Interest',
      'Blue Card Status',
      'Blue Card Number',
      'Blue Card Expiry',
      'Joined',
      'Last Active',
      'Total Hours',
      'Agreed to Terms',
      'Consent Email Updates',
      'Consent SMS Updates',
    ]

    function csvEscape(value: string | null | undefined): string {
      if (value == null) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = volunteers.map((v: typeof volunteers[number]) => {
      const totalMins = v.attendanceRecords.reduce(
        (sum: number, r: { durationMins: number | null }) => sum + (r.durationMins ?? 0),
        0
      )
      const totalHours = (totalMins / 60).toFixed(1)

      return [
        v.firstName,
        v.lastName,
        v.email,
        v.mobile,
        v.status,
        v.suburb ?? '',
        v.state ?? '',
        v.postcode ?? '',
        v.dateOfBirth ? formatDate(v.dateOfBirth) : '',
        v.emergencyName ?? '',
        v.emergencyPhone ?? '',
        v.preferredLocations.join('; '),
        v.areasOfInterest.join('; '),
        v.blueCardStatus,
        v.blueCardNumber ?? '',
        v.blueCardExpiry ? formatDate(v.blueCardExpiry) : '',
        formatDate(v.joinedAt),
        v.lastActiveAt ? formatDate(v.lastActiveAt) : '',
        totalHours,
        v.agreedToTerms ? 'Yes' : 'No',
        v.consentEmailUpdates ? 'Yes' : 'No',
        v.consentSmsUpdates ? 'Yes' : 'No',
      ]
        .map(csvEscape)
        .join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    return { success: true, csv }
  } catch (err) {
    console.error('[exportVolunteersCSVAction]', err)
    return { success: false, error: 'Failed to export volunteers.' }
  }
}

// ─── Manual attendance management ─────────────────────────────────────────────

/** Parse a "YYYY-MM-DDTHH:MM" datetime-local string as Brisbane time (UTC+10) */
function parseBrisbaneDateTime(value: string): Date {
  return new Date(`${value}:00+10:00`)
}

export async function adminCreateAttendanceAction(
  volunteerId: string,
  data: {
    signInAt: string    // "YYYY-MM-DDTHH:MM" Brisbane local
    signOutAt?: string  // "YYYY-MM-DDTHH:MM" Brisbane local, optional
    locationId?: string
  }
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const volunteer = await prisma.volunteerProfile.findUnique({ where: { id: volunteerId } })
    if (!volunteer) return { success: false, error: 'Volunteer not found.' }

    const signInAt = parseBrisbaneDateTime(data.signInAt)
    if (isNaN(signInAt.getTime())) return { success: false, error: 'Invalid sign-in time.' }

    let signOutAt: Date | null = null
    let durationMins: number | null = null

    if (data.signOutAt) {
      signOutAt = parseBrisbaneDateTime(data.signOutAt)
      if (isNaN(signOutAt.getTime())) return { success: false, error: 'Invalid sign-out time.' }
      if (signOutAt <= signInAt) return { success: false, error: 'Sign-out must be after sign-in.' }
      durationMins = Math.round((signOutAt.getTime() - signInAt.getTime()) / 60000)
    }

    await prisma.attendanceRecord.create({
      data: {
        volunteerId,
        signInAt,
        signOutAt,
        durationMins,
        locationId: data.locationId ?? null,
        kioskName: 'Manual (admin)',
      },
    })

    // Keep volunteer timestamps in sync
    await prisma.volunteerProfile.update({
      where: { id: volunteerId },
      data: {
        lastActiveAt: signOutAt ?? signInAt,
        ...(signOutAt ? { lastAttendedAt: signOutAt } : {}),
      },
    })

    return { success: true }
  } catch (err) {
    console.error('[adminCreateAttendanceAction]', err)
    return { success: false, error: 'Failed to create attendance record.' }
  }
}

export async function adminEditAttendanceAction(
  recordId: string,
  data: {
    signInAt: string    // "YYYY-MM-DDTHH:MM" Brisbane local
    signOutAt?: string  // "YYYY-MM-DDTHH:MM" Brisbane local, optional
    locationId?: string
  }
): Promise<ActionResult> {
  try {
    await requireAdminSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const existing = await prisma.attendanceRecord.findUnique({ where: { id: recordId } })
    if (!existing) return { success: false, error: 'Attendance record not found.' }

    const signInAt = parseBrisbaneDateTime(data.signInAt)
    if (isNaN(signInAt.getTime())) return { success: false, error: 'Invalid sign-in time.' }

    let signOutAt: Date | null = null
    let durationMins: number | null = null

    if (data.signOutAt) {
      signOutAt = parseBrisbaneDateTime(data.signOutAt)
      if (isNaN(signOutAt.getTime())) return { success: false, error: 'Invalid sign-out time.' }
      if (signOutAt <= signInAt) return { success: false, error: 'Sign-out must be after sign-in.' }
      durationMins = Math.round((signOutAt.getTime() - signInAt.getTime()) / 60000)
    }

    await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        signInAt,
        signOutAt,
        durationMins,
        ...(data.locationId !== undefined ? { locationId: data.locationId || null } : {}),
      },
    })

    return { success: true }
  } catch (err) {
    console.error('[adminEditAttendanceAction]', err)
    return { success: false, error: 'Failed to update attendance record.' }
  }
}

// ─── Add a user of any kind ───────────────────────────────────────────────────

export interface CreateUserData extends CreateVolunteerData {
  /** Which kinds of supporter this person is. Any combination is valid. */
  asVolunteer?: boolean
  asStaff?: boolean
  asChurchMember?: boolean
  asDonor?: boolean
  /** Donor record details (used for receipts) when asDonor is set. */
  phone?: string
  address?: string
  /** Email them a link to set a password. On unless deliberately turned off. */
  sendInvite?: boolean
}

/**
 * Create a user and set them up as any combination of volunteer, staff, church
 * member and donor.
 *
 * Note on "donor": there's no donor flag — the Donors tab is derived from actual
 * giving. Ticking Donor creates their donor record (name/phone/address for
 * receipting); they appear under Donors once a gift is recorded against them.
 *
 * Mobile is only required for volunteers, since the volunteer profile needs it.
 */

/**
 * The invite email, chosen by what the person actually is.
 *
 * The donor template thanks people for their giving and points at tax receipts,
 * which reads very oddly to a staff member being set up with a work account —
 * so staff get their own wording rather than the supporter one.
 */
async function buildInvite(opts: {
  firstName: string
  lastName: string
  link: string
  isStaff: boolean
  isVolunteer: boolean
}): Promise<{ subject: string; html: string; text: string }> {
  if (opts.isStaff) {
    const P = 'margin:0 0 16px 0;line-height:1.7;color:#374151;font-size:15px;'
    return {
      subject: 'Your Lighthouse account is ready',
      html: wrapEmailHtml(
        `
        <p style="${P}">Hi ${opts.firstName},</p>
        <p style="${P}">Your account on the <strong>My Lighthouse Portal</strong> is set up. It&rsquo;s where the team keeps track of the day-to-day:</p>
        <ul style="margin:0 0 18px 0;padding-left:20px;color:#374151;font-size:15px;line-height:1.8;">
          <li>Tasks and the daily, weekly and monthly checklists</li>
          <li>Payslips and leave, straight through to Employment Hero</li>
          <li>Staff news and updates</li>
          <li>The September step challenge</li>
        </ul>
        <p style="${P}">Pick a password and you&rsquo;re in:</p>
        <p style="margin:22px 0;"><a href="${opts.link}" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Set my password &rarr;</a></p>
        <p style="${P}">The link works for the next 7 days. If it expires, ask and we&rsquo;ll send another.</p>
        <p style="${P};margin-bottom:0;">Any trouble getting in, just reply to this email.</p>
      `,
        APP_URL
      ),
      text: `Hi ${opts.firstName},\n\nYour account on the My Lighthouse Portal is set up. It's where the team keeps track of tasks and checklists, payslips and leave, staff news, and the September step challenge.\n\nPick a password and you're in:\n${opts.link}\n\nThe link works for the next 7 days. Any trouble getting in, just reply to this email.`,
    }
  }

  const rendered = await renderTemplate(opts.isVolunteer ? 'VOLUNTEER_WELCOME' : 'DONOR_ACCOUNT_SETUP', {
    first_name: opts.firstName,
    last_name: opts.lastName,
    set_password_link: opts.link,
    portal_link: APP_URL,
  })
  return { subject: rendered.subject, html: rendered.html, text: rendered.text }
}

export async function createUserAction(
  data: CreateUserData
): Promise<{ success: boolean; userId?: string; error?: string; emailSent?: boolean; emailError?: string }> {
  // Checked per kind of supporter rather than once for the whole form: a church
  // manager may add a church member but not a volunteer, and neither manager
  // should be able to create a donor record without giving access.
  const needed: Capability[] = [
    ...(data.asVolunteer || data.asStaff ? (['care.people'] as Capability[]) : []),
    ...(data.asChurchMember ? (['church.members'] as Capability[]) : []),
    ...(data.asDonor ? (['care.giving'] as Capability[]) : []),
  ]
  try {
    // Nothing ticked is a validation problem, not a permissions one — fall back
    // to requiring people access so an empty form can't slip past the gate.
    for (const capability of needed.length > 0 ? needed : (['care.people'] as Capability[])) {
      await assertCapability(capability)
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const firstName = data.firstName?.trim()
  const lastName = data.lastName?.trim()
  const email = data.email?.trim().toLowerCase()
  if (!firstName || !lastName || !email) {
    return { success: false, error: 'First name, last name and email are required.' }
  }
  if (data.asVolunteer && !data.mobile?.trim()) {
    return { success: false, error: 'A mobile number is required for volunteers.' }
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existing) {
      return { success: false, error: 'A user with this email address already exists.' }
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: `${firstName} ${lastName}`,
        role: 'VOLUNTEER', // access level; staff/church are flags, not roles
        isStaff: Boolean(data.asStaff),
        isChurchMember: Boolean(data.asChurchMember),
        ...(data.asVolunteer
          ? {
              volunteerProfile: {
                create: {
                  firstName,
                  lastName,
                  email,
                  mobile: data.mobile!.trim(),
                  dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
                  addressLine1: data.addressLine1 || undefined,
                  addressLine2: data.addressLine2 || undefined,
                  suburb: data.suburb || undefined,
                  state: data.state || undefined,
                  postcode: data.postcode || undefined,
                  emergencyName: data.emergencyName || undefined,
                  emergencyPhone: data.emergencyPhone || undefined,
                  emergencyRelation: data.emergencyRelation || undefined,
                  status: (data.status as VolunteerStatus) ?? 'PENDING_INDUCTION',
                  notes: data.notes || undefined,
                  preferredLocations: data.preferredLocations ?? [],
                  areasOfInterest: data.areasOfInterest ?? [],
                },
              },
            }
          : {}),
        ...(data.asDonor
          ? {
              donorProfile: {
                create: {
                  displayName: `${firstName} ${lastName}`,
                  phone: data.phone?.trim() || data.mobile?.trim() || undefined,
                  address: data.address?.trim() || data.addressLine1 || undefined,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    })

    revalidatePath('/admin/users')
    revalidatePath('/admin/volunteers')
    // Invite them in. Without this the account exists but the person has no
    // password and no link — which is exactly how two staff ended up added and
    // never hearing from us.
    let emailSent = false
    let emailError: string | undefined
    if (data.sendInvite !== false) {
      try {
        const token = await createPasswordResetToken(user.id, 168)
        const rendered = await buildInvite({
          firstName,
          lastName,
          link: `${APP_URL}/set-password?token=${token}`,
          isStaff: Boolean(data.asStaff),
          isVolunteer: Boolean(data.asVolunteer),
        })
        const result = await sendEmail({
          to: email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        })
        emailSent = result.success
        if (!result.success) emailError = 'The account was created but the invite email didn’t send.'
      } catch (err) {
        console.error('createUserAction: invite email failed', err)
        emailError = 'The account was created but the invite email didn’t send.'
      }
    }

    return { success: true, userId: user.id, emailSent, emailError }
  } catch (err) {
    console.error('[createUserAction]', err)
    return { success: false, error: 'Could not create the user. Please try again.' }
  }
}

/**
 * Send (or resend) the set-a-password invite for an existing account.
 *
 * Needed because an account can exist without anyone ever having been told
 * about it — which is how two staff ended up added and unable to sign in.
 * Issuing a new token invalidates any earlier unused one.
 */
export async function sendAccountInviteAction(
  userId: string
): Promise<{ success: boolean; error?: string; sentTo?: string }> {
  try {
    await assertCapability('care.people')
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isStaff: true,
      isTrainee: true,
      volunteerProfile: { select: { id: true } },
    },
  })
  if (!user?.email) return { success: false, error: 'That account has no email address.' }

  const firstName = user.name?.trim().split(/\s+/)[0] || 'there'
  const lastName = user.name?.trim().split(/\s+/).slice(1).join(' ') || ''

  try {
    const token = await createPasswordResetToken(user.id, 168)
    const rendered = await buildInvite({
      firstName,
      lastName,
      link: `${APP_URL}/set-password?token=${token}`,
      isStaff: user.isStaff || user.isTrainee,
      isVolunteer: Boolean(user.volunteerProfile),
    })
    const result = await sendEmail({
      to: user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })
    if (!result.success) return { success: false, error: 'Could not send that. Please try again.' }
  } catch (err) {
    console.error('sendAccountInviteAction failed', err)
    return { success: false, error: 'Could not send that. Please try again.' }
  }

  revalidatePath(`/admin/users/${userId}`)
  return { success: true, sentTo: user.email }
}

// ─── Admin roles on existing accounts ─────────────────────────────────────────

const ADMIN_ROLES_SET = new Set(['SUPER_ADMIN', 'ADMIN', 'CARE_MANAGER', 'CHURCH_MANAGER'])

export interface UserSearchResult {
  id: string
  name: string | null
  email: string
  role: string
  canViewDonations: boolean
}

/**
 * Find an existing account to give an admin role to.
 *
 * Only reachable by someone who can already assign roles, so it deliberately
 * searches every account rather than the scoped user lists.
 */
export async function searchUsersForRoleAction(query: string): Promise<UserSearchResult[]> {
  try {
    await assertCapability('system.users')
  } catch {
    return []
  }
  const q = query.trim()
  if (q.length < 2) return []

  return prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, role: true, canViewDonations: true },
    orderBy: { name: 'asc' },
    take: 8,
  })
}

/**
 * Give an existing account an admin role, or take one away.
 *
 * Two guards worth keeping: an account with no password cannot be made an
 * admin, because nobody has ever proved they control it; and the last active
 * super admin cannot be demoted, since that would lock everyone out of role
 * management with no way back in.
 */
export async function setUserRoleAction(
  userId: string,
  role: string,
  canViewDonations: boolean
): Promise<{ success: boolean; error?: string }> {
  let me: { userId: string }
  try {
    me = await assertCapability('system.users')
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (role !== 'VOLUNTEER' && !ADMIN_ROLES_SET.has(role)) {
    return { success: false, error: 'That is not a role you can assign here.' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordHash: true, email: true },
  })
  if (!user) return { success: false, error: 'That account no longer exists.' }

  if (ADMIN_ROLES_SET.has(role) && !user.passwordHash) {
    return {
      success: false,
      error: 'That account has no password yet. Send them a set-password invite first, then make them an admin.',
    }
  }

  if (user.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
    const others = await prisma.user.count({
      where: { role: 'SUPER_ADMIN', isActive: true, id: { not: userId } },
    })
    if (others === 0) {
      return { success: false, error: 'That is the only super admin. Make someone else one first.' }
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: role as UserRole,
        // Only a generic ADMIN uses this flag; the scoped roles carry their own.
        canViewDonations: role === 'ADMIN' ? canViewDonations : false,
      },
    })
    console.info(`[roles] ${me.userId} set ${user.email} to ${role}`)
  } catch (err) {
    console.error('setUserRoleAction failed', err)
    return { success: false, error: 'Could not save that. Please try again.' }
  }

  revalidatePath('/admin/settings')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}
