'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { formatDate } from '@/lib/utils'
import type { VolunteerStatus } from '@prisma/client'

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
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new Error('Insufficient permissions')
  }
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
export async function createUserAction(
  data: CreateUserData
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    await requireAdminSession()
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
    return { success: true, userId: user.id }
  } catch (err) {
    console.error('[createUserAction]', err)
    return { success: false, error: 'Could not create the user. Please try again.' }
  }
}
