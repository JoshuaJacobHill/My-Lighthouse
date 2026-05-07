'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { format } from 'date-fns'

export type RecurringFrequency = 'ONE_OFF' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

interface ActionResult {
  success: boolean
  error?: string
  bookedCount?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if shiftDate fits the recurrence pattern anchored at anchorDate. */
function matchesFrequency(anchorDate: Date, shiftDate: Date, frequency: Exclude<RecurringFrequency, 'ONE_OFF'>): boolean {
  const anchorMs = Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), anchorDate.getUTCDate())
  const shiftMs  = Date.UTC(shiftDate.getUTCFullYear(),  shiftDate.getUTCMonth(),  shiftDate.getUTCDate())
  const diffDays = Math.round((shiftMs - anchorMs) / 86_400_000)
  if (diffDays < 0) return false
  if (frequency === 'WEEKLY')      return diffDays % 7  === 0
  if (frequency === 'FORTNIGHTLY') return diffDays % 14 === 0
  if (frequency === 'MONTHLY')     return diffDays % 28 === 0
  return false
}

// ─── Book a shift ─────────────────────────────────────────────────────────────

export async function bookShiftAction(
  shiftId: string,
  frequency: RecurringFrequency = 'ONE_OFF',
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.volunteerId) return { success: false, error: 'Not authenticated' }
  const volunteerId = session.volunteerId

  try {
    const [shift, volunteer] = await Promise.all([
      prisma.shift.findUnique({
        where: { id: shiftId },
        include: { location: true },
      }),
      prisma.volunteerProfile.findUnique({
        where: { id: volunteerId },
        select: { firstName: true, lastName: true, email: true },
      }),
    ])

    if (!shift || !shift.isActive) return { success: false, error: 'Shift not found or no longer available.' }
    if (!volunteer)                return { success: false, error: 'Volunteer profile not found.' }

    // ── Book the immediate shift ───────────────────────────────────────────────
    const existing = await prisma.shiftAssignment.findUnique({
      where: { shiftId_volunteerId: { shiftId, volunteerId } },
    })
    if (existing && existing.status !== 'CANCELLED_BY_VOLUNTEER' && existing.status !== 'ADMIN_CANCELLED') {
      return { success: false, error: 'You are already booked for this shift.' }
    }
    if (existing) {
      await prisma.shiftAssignment.update({
        where: { id: existing.id },
        data: { status: 'SCHEDULED', cancelledAt: null, cancelReason: null },
      })
    } else {
      await prisma.shiftAssignment.create({
        data: { shiftId, volunteerId, status: 'SCHEDULED' },
      })
    }

    let bookedCount = 1

    // ── Recurring: book all matching future shifts + save preference ───────────
    if (frequency !== 'ONE_OFF' && shift.title) {
      const now = new Date()
      const anchorDate = shift.date

      // Find all future shifts that share location, title, and day of week
      const candidates = await prisma.shift.findMany({
        where: {
          id: { not: shiftId },
          locationId: shift.locationId,
          title: shift.title,
          isActive: true,
          date: { gt: now },
        },
        select: { id: true, date: true },
        orderBy: { date: 'asc' },
      })

      const matchingIds = candidates
        .filter(s => matchesFrequency(anchorDate, s.date, frequency))
        .map(s => s.id)

      if (matchingIds.length > 0) {
        // Get existing bookings so we don't double-book
        const alreadyBooked = await prisma.shiftAssignment.findMany({
          where: {
            volunteerId,
            shiftId: { in: matchingIds },
            status: { notIn: ['CANCELLED_BY_VOLUNTEER', 'ADMIN_CANCELLED'] },
          },
          select: { shiftId: true },
        })
        const bookedSet = new Set(alreadyBooked.map(a => a.shiftId))
        const toBook = matchingIds.filter(id => !bookedSet.has(id))

        if (toBook.length > 0) {
          await prisma.shiftAssignment.createMany({
            data: toBook.map(sid => ({ shiftId: sid, volunteerId, status: 'SCHEDULED' })),
            skipDuplicates: true,
          })
          bookedCount += toBook.length
        }
      }

      // Deactivate any existing recurring preference for this same slot, then create new one
      await prisma.recurringBooking.updateMany({
        where: {
          volunteerId,
          locationId: shift.locationId,
          shiftTitle: shift.title,
          dayOfWeek: shift.date.getUTCDay(),
          isActive: true,
        },
        data: { isActive: false },
      })
      await prisma.recurringBooking.create({
        data: {
          volunteerId,
          locationId: shift.locationId,
          shiftTitle: shift.title,
          dayOfWeek: shift.date.getUTCDay(),
          anchorDate: shift.date,
          frequency,
        },
      })
    }

    // ── Admin notification ─────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      const shiftDate = format(new Date(shift.date), 'EEEE d MMMM yyyy')
      const shiftTime = `${format(new Date(shift.startTime), 'h:mmaaa')}–${format(new Date(shift.endTime), 'h:mmaaa')}`
      const recurringNote = frequency !== 'ONE_OFF'
        ? ` (${frequency.toLowerCase()} recurring — ${bookedCount} shift${bookedCount !== 1 ? 's' : ''} booked)`
        : ''
      await sendEmail({
        to: adminEmail,
        subject: `Shift booking: ${volunteer.firstName} ${volunteer.lastName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Volunteer Shift Booking</h2>
            <p><strong>${volunteer.firstName} ${volunteer.lastName}</strong> has booked a shift${recurringNote}.</p>
            <ul>
              <li><strong>Date:</strong> ${shiftDate}</li>
              <li><strong>Time:</strong> ${shiftTime}</li>
              <li><strong>Location:</strong> ${shift.location.name}</li>
              ${shift.title ? `<li><strong>Shift:</strong> ${shift.title}</li>` : ''}
              ${frequency !== 'ONE_OFF' ? `<li><strong>Recurring:</strong> ${frequency.charAt(0) + frequency.slice(1).toLowerCase()}</li>` : ''}
            </ul>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/volunteers/${volunteerId}">View volunteer profile</a></p>
          </div>
        `,
        text: `${volunteer.firstName} ${volunteer.lastName} has booked a shift on ${shiftDate} at ${shiftTime} — ${shift.location.name}${recurringNote}.`,
        volunteerId,
        ccAdmin: true,
      })
    }

    return { success: true, bookedCount }
  } catch (err) {
    console.error('[bookShiftAction]', err)
    return { success: false, error: 'Failed to book shift. Please try again.' }
  }
}

// ─── Cancel a shift booking ───────────────────────────────────────────────────

export async function cancelShiftAction(shiftId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.volunteerId) {
    return { success: false, error: 'Not authenticated' }
  }

  const volunteerId = session.volunteerId

  try {
    const [assignment, volunteer] = await Promise.all([
      prisma.shiftAssignment.findFirst({
        where: {
          shiftId,
          volunteerId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        include: {
          shift: { include: { location: true } },
        },
      }),
      prisma.volunteerProfile.findUnique({
        where: { id: volunteerId },
        select: { firstName: true, lastName: true },
      }),
    ])

    if (!assignment) {
      return { success: false, error: 'Shift booking not found.' }
    }

    if (!volunteer) {
      return { success: false, error: 'Volunteer profile not found.' }
    }

    await prisma.shiftAssignment.update({
      where: { id: assignment.id },
      data: {
        status: 'CANCELLED_BY_VOLUNTEER',
        cancelledAt: new Date(),
      },
    })

    // Send notification email to admin
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      const shiftDate = format(new Date(assignment.shift.date), 'EEEE d MMMM yyyy')
      const shiftTime = `${format(new Date(assignment.shift.startTime), 'h:mmaaa')}–${format(new Date(assignment.shift.endTime), 'h:mmaaa')}`
      await sendEmail({
        to: adminEmail,
        subject: `Shift cancellation: ${volunteer.firstName} ${volunteer.lastName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Volunteer Shift Cancellation</h2>
            <p><strong>${volunteer.firstName} ${volunteer.lastName}</strong> has cancelled their shift.</p>
            <ul>
              <li><strong>Date:</strong> ${shiftDate}</li>
              <li><strong>Time:</strong> ${shiftTime}</li>
              <li><strong>Location:</strong> ${assignment.shift.location.name}</li>
              ${assignment.shift.title ? `<li><strong>Shift:</strong> ${assignment.shift.title}</li>` : ''}
            </ul>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/volunteers/${volunteerId}">View volunteer profile</a></p>
          </div>
        `,
        text: `${volunteer.firstName} ${volunteer.lastName} has cancelled their shift on ${shiftDate} at ${shiftTime} — ${assignment.shift.location.name}.`,
        volunteerId,
      })
    }

    return { success: true }
  } catch (err) {
    console.error('[cancelShiftAction]', err)
    return { success: false, error: 'Failed to cancel shift. Please try again.' }
  }
}
