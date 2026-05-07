'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

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
  volunteerArea?: string
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

    // Check if they're already signed in (no sign-out time, signed in today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingSignIn = await prisma.attendanceRecord.findFirst({
      where: {
        volunteerId,
        signInAt: { gte: today },
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
        volunteerArea: data.volunteerArea?.trim() ?? null,
        emergencyContact: data.emergencyContact?.trim() ?? null,
        safetyAcknowledged: data.safetyAcknowledged,
        locationId: data.locationId ?? null,
        kioskName: data.kioskName ?? null,
        signInAt: new Date(),
      },
    })

    return { success: true, attendanceId: record.id }
  } catch (err) {
    console.error('[guestSignInAction]', err)
    return { success: false, error: 'Guest sign-in failed. Please try again.' }
  }
}
