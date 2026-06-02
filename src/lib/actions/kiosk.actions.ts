'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://volunteers.lighthousecare.org.au'
const ORANGE = '#f97316'
const P = `margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;`
const BTN = `background:${ORANGE};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;`

interface ActionResult {
  success: boolean
  error?: string
  data?: unknown
}

interface GuestSignInData {
  firstName: string
  lastName: string
  mobile?: string
  email?: string
  organisation?: string
  isCorporateDay?: boolean
  emergencyContact?: string
  safetyAcknowledged: boolean
  locationId?: string
  kioskName?: string
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireKioskSession(): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }
  const allowedRoles = ['KIOSK', 'ADMIN', 'SUPER_ADMIN']
  if (!allowedRoles.includes(session.role)) {
    throw new Error('Insufficient permissions — kiosk access required')
  }
  return { userId: session.userId, role: session.role }
}

// ─── Volunteer lookup ─────────────────────────────────────────────────────────

export async function kioskLookupAction(query: string): Promise<
  ActionResult & {
    results?: Array<{
      id: string
      firstName: string
      lastName: string
      email: string
      status: string
    }>
  }
> {
  try {
    await requireKioskSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!query || query.trim().length < 2) {
    return { success: false, error: 'Please enter at least 2 characters to search.' }
  }

  const q = query.trim()

  try {
    const volunteers = await prisma.volunteerProfile.findMany({
      where: {
        AND: [
          { status: { not: 'REMOVED' } },
          {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { mobile: { contains: q } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
      },
      take: 10,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return { success: true, results: volunteers }
  } catch (err) {
    console.error('[kioskLookupAction]', err)
    return { success: false, error: 'Search failed. Please try again.' }
  }
}

// ─── Volunteer sign-in ────────────────────────────────────────────────────────

export async function kioskSignInAction(
  volunteerId: string,
  locationId: string,
  kioskName?: string
): Promise<ActionResult & { attendanceId?: string }> {
  try {
    await requireKioskSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    // Check volunteer exists and is not removed
    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
      select: { id: true, status: true, firstName: true, lastName: true },
    })

    if (!volunteer) {
      return { success: false, error: 'Volunteer not found.' }
    }

    if (volunteer.status === 'REMOVED') {
      return { success: false, error: 'This volunteer account is no longer active.' }
    }

    // Check if they're already signed in (any open record with no sign-out)
    const existingSignIn = await prisma.attendanceRecord.findFirst({
      where: {
        volunteerId,
        signOutAt: null,
      },
    })

    if (existingSignIn) {
      return {
        success: false,
        error: `${volunteer.firstName} is already signed in. Please sign out first.`,
      }
    }

    // Verify location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    })

    if (!location) {
      return { success: false, error: 'Location not found.' }
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        volunteerId,
        locationId,
        signInAt: new Date(),
        kioskName: kioskName ?? null,
      },
    })

    // Update volunteer's last active timestamp
    await prisma.volunteerProfile.update({
      where: { id: volunteerId },
      data: {
        lastActiveAt: new Date(),
        // Legacy: upgrade INDUCTED → ACTIVE on first kiosk sign-in
        status: volunteer.status === 'INDUCTED' ? 'ACTIVE' : undefined,
      },
    })

    return { success: true, attendanceId: record.id }
  } catch (err) {
    console.error('[kioskSignInAction]', err)
    return { success: false, error: 'Sign-in failed. Please try again.' }
  }
}

// ─── Volunteer sign-out ───────────────────────────────────────────────────────

export async function kioskSignOutAction(attendanceRecordId: string): Promise<
  ActionResult & { durationMins?: number; durationLabel?: string }
> {
  try {
    await requireKioskSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceRecordId },
    })

    if (!record) {
      return { success: false, error: 'Attendance record not found.' }
    }

    if (record.signOutAt) {
      return { success: false, error: 'Already signed out.' }
    }

    const signOutAt = new Date()
    const durationMins = Math.round(
      (signOutAt.getTime() - record.signInAt.getTime()) / 1000 / 60
    )

    await prisma.attendanceRecord.update({
      where: { id: attendanceRecordId },
      data: { signOutAt, durationMins },
    })

    // Update volunteer's last attended timestamp
    await prisma.volunteerProfile.update({
      where: { id: record.volunteerId },
      data: {
        lastAttendedAt: signOutAt,
        lastActiveAt: signOutAt,
      },
    })

    // Format duration for display
    const hours = Math.floor(durationMins / 60)
    const mins = durationMins % 60
    const durationLabel =
      hours === 0 ? `${mins}m` : mins === 0 ? `${hours}h` : `${hours}h ${mins}m`

    return { success: true, durationMins, durationLabel }
  } catch (err) {
    console.error('[kioskSignOutAction]', err)
    return { success: false, error: 'Sign-out failed. Please try again.' }
  }
}

// ─── Guest sign-in ────────────────────────────────────────────────────────────

export async function guestSignInAction(data: GuestSignInData): Promise<
  ActionResult & { attendanceId?: string }
> {
  try {
    await requireKioskSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  if (!data.firstName || !data.lastName) {
    return { success: false, error: 'First name and last name are required.' }
  }

  if (!data.safetyAcknowledged) {
    return {
      success: false,
      error: 'Safety acknowledgement is required before signing in.',
    }
  }

  try {
    // Verify location if provided
    if (data.locationId) {
      const location = await prisma.location.findUnique({
        where: { id: data.locationId },
        select: { id: true },
      })
      if (!location) {
        return { success: false, error: 'Location not found.' }
      }
    }

    const record = await prisma.guestAttendanceRecord.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        mobile: data.mobile?.trim() ?? null,
        email: data.email?.trim() ?? null,
        organisation: data.organisation?.trim() ?? null,
        isCorporateDay: data.isCorporateDay ?? false,
        volunteerArea: null,
        emergencyContact: data.emergencyContact?.trim() ?? null,
        safetyAcknowledged: data.safetyAcknowledged,
        locationId: data.locationId ?? null,
        kioskName: data.kioskName ?? null,
        signInAt: new Date(),
      },
    })

    // Send follow-up email if email was provided — fire and forget
    if (data.email?.trim()) {
      const firstName = data.firstName.trim()
      const signUpLink = `${APP_URL}/signup`
      const html = wrapEmailHtml(`
        <p style="${P}">Hi ${firstName},</p>
        <p style="${P}">Thanks so much for volunteering with Lighthouse Care today — we really appreciate you giving your time to help our community!</p>
        <p style="${P}">As a guest volunteer, you&rsquo;re always welcome to come back. But if you&rsquo;d like to become an official member of the team, it&rsquo;s easy to sign up. As a registered volunteer you&rsquo;ll get access to:</p>
        <ul style="margin:0 0 18px 0;padding-left:20px;color:#374151;font-size:15px;line-height:2;">
          <li>Your own volunteer account and shift history</li>
          <li>The ability to book shifts that suit your schedule</li>
          <li>Our online induction and training materials</li>
          <li>Updates and news from the team</li>
        </ul>
        <p style="${P}">It only takes a few minutes to get started:</p>
        <p style="margin:24px 0;"><a href="${signUpLink}" style="${BTN}">Join the Volunteer Team &rarr;</a></p>
        <p style="${P}">We hope to see you again soon — and thank you again for making a difference today.</p>
        <p style="${P};margin-bottom:0;">Warm regards,<br>The Lighthouse Care Team</p>
      `, APP_URL)

      const text = `Hi ${firstName},\n\nThanks so much for volunteering with Lighthouse Care today!\n\nIf you'd like to become an official member of our volunteer team, it's easy to sign up at: ${signUpLink}\n\nAs a registered volunteer you'll be able to book shifts, track your hours, complete your online induction, and stay in the loop.\n\nWe hope to see you again soon!\n\nWarm regards,\nThe Lighthouse Care Team`

      sendEmail({
        to: data.email.trim(),
        subject: `Thanks for volunteering today, ${firstName}!`,
        html,
        text,
      }).catch((err) => console.error('[guestSignInAction] email error:', err))
    }

    return { success: true, attendanceId: record.id }
  } catch (err) {
    console.error('[guestSignInAction]', err)
    return { success: false, error: 'Guest sign-in failed. Please try again.' }
  }
}

// ─── On-site volunteers (kiosk) ──────────────────────────────────────────────

export interface OnSiteVolunteer {
  id: string           // attendanceRecord id
  volunteerId: string
  firstName: string
  lastName: string
  signInAt: string     // ISO string
}

export async function kioskGetOnSiteVolunteersAction(): Promise<
  ActionResult & { volunteers?: OnSiteVolunteer[] }
> {
  try {
    await requireKioskSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { signOutAt: null },
      select: {
        id: true,
        signInAt: true,
        volunteer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { signInAt: 'asc' },
    })

    return {
      success: true,
      volunteers: records.map((r) => ({
        id: r.id,
        volunteerId: r.volunteer.id,
        firstName: r.volunteer.firstName,
        lastName: r.volunteer.lastName,
        signInAt: r.signInAt.toISOString(),
      })),
    }
  } catch (err) {
    console.error('[kioskGetOnSiteVolunteersAction]', err)
    return { success: false, error: 'Failed to fetch on-site volunteers.' }
  }
}

// ─── On-site guests (kiosk) ───────────────────────────────────────────────────

export interface OnSiteGuest {
  id: string
  firstName: string
  lastName: string
  mobile: string | null
  signInAt: string // ISO string
}

export async function kioskGetOnSiteGuestsAction(): Promise<
  ActionResult & { guests?: OnSiteGuest[] }
> {
  try {
    await requireKioskSession()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const records = await prisma.guestAttendanceRecord.findMany({
      where: { signOutAt: null },
      select: { id: true, firstName: true, lastName: true, mobile: true, signInAt: true },
      orderBy: { signInAt: 'asc' },
    })

    return {
      success: true,
      guests: records.map((r) => ({
        ...r,
        signInAt: r.signInAt.toISOString(),
      })),
    }
  } catch (err) {
    console.error('[kioskGetOnSiteGuestsAction]', err)
    return { success: false, error: 'Failed to fetch on-site guests.' }
  }
}

// ─── Guest sign-out (kiosk) ───────────────────────────────────────────────────

export async function kioskGuestSignOutAction(
  guestId: string
): Promise<ActionResult & { durationLabel?: string }> {
  try {
    await requireKioskSession()
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

    const hours = Math.floor(durationMins / 60)
    const mins = durationMins % 60
    const durationLabel =
      hours === 0 ? `${mins}m` : mins === 0 ? `${hours}h` : `${hours}h ${mins}m`

    return { success: true, durationLabel }
  } catch (err) {
    console.error('[kioskGuestSignOutAction]', err)
    return { success: false, error: 'Failed to sign out guest.' }
  }
}
