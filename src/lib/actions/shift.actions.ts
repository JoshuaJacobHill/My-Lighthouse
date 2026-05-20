'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'
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

    // ── Volunteer confirmation email ───────────────────────────────────────────
    try {
      const BRISBANE_TZ = 'Australia/Brisbane'
      const shiftDateFormatted = new Date(shift.date).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: BRISBANE_TZ,
      })
      const shiftTimeFormatted = `${new Date(shift.startTime).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BRISBANE_TZ })} – ${new Date(shift.endTime).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BRISBANE_TZ })}`

      let recurringNote = ''
      if (frequency !== 'ONE_OFF') {
        const freqLabel = frequency === 'WEEKLY' ? 'weekly' : frequency === 'FORTNIGHTLY' ? 'fortnightly' : 'monthly (every 4 weeks)'
        recurringNote = `This is a standing shift — we've booked you in ${freqLabel} from this date (${bookedCount} shift${bookedCount !== 1 ? 's' : ''} total). New shifts will be added automatically as they're rostered. To cancel individual shifts or stop the recurring booking, visit the volunteer portal.`
      } else {
        recurringNote = 'This is a one-off booking. If your plans change, you can cancel from the volunteer portal.'
      }

      const template = await renderTemplate('SHIFT_BOOKED', {
        first_name: volunteer.firstName,
        last_name: volunteer.lastName,
        shift_date: shiftDateFormatted,
        shift_time: shiftTimeFormatted,
        location: shift.location.name,
        recurring_note: recurringNote,
        portal_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/volunteer/roster`,
      })

      await sendEmail({
        to: volunteer.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        templateType: 'SHIFT_BOOKED',
        volunteerId,
      })
    } catch (emailErr) {
      console.error('[bookShiftAction] confirmation email failed:', emailErr)
      // Don't fail the booking if email fails
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

// ─── Module-level helper: find or create a shift record ──────────────────────

async function findOrCreateShiftRecord(
  locationId: string,
  dateStr: string,
  startTime: string,
  endTime: string,
): Promise<string> {
  const startDt = new Date(`${dateStr}T${startTime}:00+10:00`)
  const endDt   = new Date(`${dateStr}T${endTime}:00+10:00`)
  const dateDt  = new Date(dateStr)

  const existing = await prisma.shift.findFirst({
    where: { locationId, isActive: true, date: dateDt, startTime: startDt, endTime: endDt },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.shift.create({
    data: { locationId, date: dateDt, startTime: startDt, endTime: endDt, capacity: 99, isActive: true },
  })
  return created.id
}

// ─── Book a custom shift (volunteer-created time slot) ───────────────────────

export async function bookCustomShiftAction(input: {
  locationId: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:MM Brisbane
  endTime: string     // HH:MM Brisbane
  frequency: RecurringFrequency
}): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.volunteerId) return { success: false, error: 'Not authenticated' }
  const volunteerId = session.volunteerId

  const { locationId, date, startTime, endTime, frequency } = input

  try {
    const [location, volunteer] = await Promise.all([
      prisma.location.findUnique({ where: { id: locationId } }),
      prisma.volunteerProfile.findUnique({
        where: { id: volunteerId },
        select: { firstName: true, lastName: true, email: true },
      }),
    ])

    if (!location) return { success: false, error: 'Location not found.' }
    if (!volunteer) return { success: false, error: 'Volunteer profile not found.' }

    // ── Helper: upsert assignment; returns false if already active ─────────────
    async function bookAssignment(shiftId: string): Promise<boolean> {
      const existing = await prisma.shiftAssignment.findUnique({
        where: { shiftId_volunteerId: { shiftId, volunteerId } },
      })
      if (existing) {
        if (existing.status !== 'CANCELLED_BY_VOLUNTEER' && existing.status !== 'ADMIN_CANCELLED') {
          return false // already active
        }
        await prisma.shiftAssignment.update({
          where: { id: existing.id },
          data: { status: 'SCHEDULED', cancelledAt: null, cancelReason: null },
        })
        return true
      }
      await prisma.shiftAssignment.create({
        data: { shiftId, volunteerId, status: 'SCHEDULED' },
      })
      return true
    }

    // ── Book anchor shift ──────────────────────────────────────────────────────
    const anchorShiftId = await findOrCreateShiftRecord(locationId, date, startTime, endTime)
    const anchorBooked = await bookAssignment(anchorShiftId)
    if (!anchorBooked) {
      return { success: false, error: 'You are already booked for this shift.' }
    }

    let bookedCount = 1

    // ── Recurring: create + book future occurrences ────────────────────────────
    const FREQ_DAYS: Record<Exclude<RecurringFrequency, 'ONE_OFF'>, number> = {
      WEEKLY: 7,
      FORTNIGHTLY: 14,
      MONTHLY: 28,
    }

    if (frequency !== 'ONE_OFF') {
      const freqDays = FREQ_DAYS[frequency]
      const anchorMs = new Date(date).getTime()

      for (let i = 1; i <= 12; i++) {
        const futureMs = anchorMs + i * freqDays * 86_400_000
        const futureDate = new Date(futureMs)
        // Skip Sundays
        if (futureDate.getUTCDay() === 0) continue
        const futureDateStr = futureDate.toISOString().slice(0, 10)
        const futureShiftId = await findOrCreateShiftRecord(locationId, futureDateStr, startTime, endTime)
        const booked = await bookAssignment(futureShiftId)
        if (booked) bookedCount++
      }

      // Save recurring booking preference
      const shiftTitle = `${startTime}–${endTime}`
      const dayOfWeek = new Date(date).getUTCDay()

      await prisma.recurringBooking.updateMany({
        where: { volunteerId, locationId, shiftTitle, dayOfWeek, isActive: true },
        data: { isActive: false },
      })
      await prisma.recurringBooking.create({
        data: {
          volunteerId,
          locationId,
          shiftTitle,
          dayOfWeek,
          anchorDate: new Date(date),
          frequency,
        },
      })
    }

    // ── Volunteer confirmation email ───────────────────────────────────────────
    try {
      const BRISBANE_TZ = 'Australia/Brisbane'
      const anchorStart = new Date(`${date}T${startTime}:00+10:00`)
      const anchorEnd   = new Date(`${date}T${endTime}:00+10:00`)
      const shiftDateFormatted = anchorStart.toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: BRISBANE_TZ,
      })
      const shiftTimeFormatted = `${anchorStart.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BRISBANE_TZ })} – ${anchorEnd.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: BRISBANE_TZ })}`

      let recurringNote = ''
      if (frequency !== 'ONE_OFF') {
        const freqLabel = frequency === 'WEEKLY' ? 'weekly' : frequency === 'FORTNIGHTLY' ? 'fortnightly' : 'monthly (every 4 weeks)'
        recurringNote = `This is a standing shift — we've booked you in ${freqLabel} from this date (${bookedCount} shift${bookedCount !== 1 ? 's' : ''} total). To cancel individual shifts or stop the recurring booking, visit the volunteer portal.`
      } else {
        recurringNote = 'This is a one-off booking. If your plans change, you can cancel from the volunteer portal.'
      }

      const template = await renderTemplate('SHIFT_BOOKED', {
        first_name: volunteer.firstName,
        last_name: volunteer.lastName,
        shift_date: shiftDateFormatted,
        shift_time: shiftTimeFormatted,
        location: location.name,
        recurring_note: recurringNote,
        portal_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/volunteer/roster`,
      })

      await sendEmail({
        to: volunteer.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        templateType: 'SHIFT_BOOKED',
        volunteerId,
      })
    } catch (emailErr) {
      console.error('[bookCustomShiftAction] confirmation email failed:', emailErr)
    }

    // ── Admin notification ─────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      const shiftDate = format(new Date(date), 'EEEE d MMMM yyyy')
      const shiftTime = `${startTime}–${endTime}`
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
              <li><strong>Location:</strong> ${location.name}</li>
              ${frequency !== 'ONE_OFF' ? `<li><strong>Recurring:</strong> ${frequency.charAt(0) + frequency.slice(1).toLowerCase()}</li>` : ''}
            </ul>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/volunteers/${volunteerId}">View volunteer profile</a></p>
          </div>
        `,
        text: `${volunteer.firstName} ${volunteer.lastName} has booked a shift on ${shiftDate} at ${shiftTime} — ${location.name}${recurringNote}.`,
        volunteerId,
        ccAdmin: true,
      })
    }

    return { success: true, bookedCount }
  } catch (err) {
    console.error('[bookCustomShiftAction]', err)
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

// ─── Edit an existing shift booking ──────────────────────────────────────────

export async function editShiftBookingAction(
  assignmentId: string,
  data: { locationId: string; date: string; startTime: string; endTime: string },
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.volunteerId) return { success: false, error: 'Not authenticated' }
  const volunteerId = session.volunteerId

  try {
    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        id: assignmentId,
        volunteerId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: { shift: { include: { location: true } } },
    })

    if (!assignment) return { success: false, error: 'Booking not found.' }

    const newShiftId = await findOrCreateShiftRecord(data.locationId, data.date, data.startTime, data.endTime)

    if (newShiftId === assignment.shiftId) return { success: false, error: 'No changes made.' }

    await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: 'CANCELLED_BY_VOLUNTEER', cancelledAt: new Date() },
    })

    await prisma.shiftAssignment.create({
      data: { shiftId: newShiftId, volunteerId, status: 'SCHEDULED' },
    })

    // Admin notification
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      const volunteer = await prisma.volunteerProfile.findUnique({
        where: { id: volunteerId },
        select: { firstName: true, lastName: true },
      })
      const shiftDate = format(new Date(data.date), 'EEEE d MMMM yyyy')
      const shiftTime = `${data.startTime}–${data.endTime}`
      const location = await prisma.location.findUnique({ where: { id: data.locationId }, select: { name: true } })
      await sendEmail({
        to: adminEmail,
        subject: `Shift booking updated: ${volunteer?.firstName ?? ''} ${volunteer?.lastName ?? ''}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Volunteer Shift Booking Updated</h2>
            <p><strong>${volunteer?.firstName ?? ''} ${volunteer?.lastName ?? ''}</strong> has changed their shift booking.</p>
            <ul>
              <li><strong>New Date:</strong> ${shiftDate}</li>
              <li><strong>New Time:</strong> ${shiftTime}</li>
              <li><strong>Location:</strong> ${location?.name ?? data.locationId}</li>
            </ul>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/volunteers/${volunteerId}">View volunteer profile</a></p>
          </div>
        `,
        text: `${volunteer?.firstName ?? ''} ${volunteer?.lastName ?? ''} has updated their shift booking to ${shiftDate} at ${shiftTime} — ${location?.name ?? data.locationId}.`,
        volunteerId,
        ccAdmin: true,
      })
    }

    return { success: true }
  } catch (err) {
    console.error('[editShiftBookingAction]', err)
    return { success: false, error: 'Failed to update booking. Please try again.' }
  }
}

// ─── Admin: book a shift for a volunteer ─────────────────────────────────────

async function requireAdminSessionForShifts(): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') throw new Error('Insufficient permissions')
}

export async function adminBookShiftForVolunteerAction(
  volunteerId: string,
  input: { locationId: string; date: string; startTime: string; endTime: string; frequency: 'ONCE' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' }
): Promise<ActionResult> {
  try {
    await requireAdminSessionForShifts()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  const { locationId, date, startTime, endTime, frequency } = input
  // Map from admin frequency values to internal values
  const internalFreq: RecurringFrequency = frequency === 'ONCE' ? 'ONE_OFF' : frequency

  try {
    const location = await prisma.location.findUnique({ where: { id: locationId } })
    if (!location) return { success: false, error: 'Location not found.' }

    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
      select: { id: true },
    })
    if (!volunteer) return { success: false, error: 'Volunteer not found.' }

    async function bookAssignment(shiftId: string): Promise<boolean> {
      const existing = await prisma.shiftAssignment.findUnique({
        where: { shiftId_volunteerId: { shiftId, volunteerId } },
      })
      if (existing) {
        if (existing.status !== 'CANCELLED_BY_VOLUNTEER' && existing.status !== 'ADMIN_CANCELLED') {
          return false
        }
        await prisma.shiftAssignment.update({
          where: { id: existing.id },
          data: { status: 'SCHEDULED', cancelledAt: null, cancelReason: null },
        })
        return true
      }
      await prisma.shiftAssignment.create({
        data: { shiftId, volunteerId, status: 'SCHEDULED' },
      })
      return true
    }

    const anchorShiftId = await findOrCreateShiftRecord(locationId, date, startTime, endTime)
    const anchorBooked = await bookAssignment(anchorShiftId)
    if (!anchorBooked) {
      return { success: false, error: 'Volunteer is already booked for this shift.' }
    }

    let bookedCount = 1

    if (internalFreq !== 'ONE_OFF') {
      const FREQ_DAYS: Record<Exclude<RecurringFrequency, 'ONE_OFF'>, number> = {
        WEEKLY: 7,
        FORTNIGHTLY: 14,
        MONTHLY: 28,
      }
      const freqDays = FREQ_DAYS[internalFreq]
      const anchorMs = new Date(date).getTime()

      for (let i = 1; i <= 12; i++) {
        const futureMs = anchorMs + i * freqDays * 86_400_000
        const futureDate = new Date(futureMs)
        if (futureDate.getUTCDay() === 0) continue
        const futureDateStr = futureDate.toISOString().slice(0, 10)
        const futureShiftId = await findOrCreateShiftRecord(locationId, futureDateStr, startTime, endTime)
        const booked = await bookAssignment(futureShiftId)
        if (booked) bookedCount++
      }
    }

    return { success: true, bookedCount }
  } catch (err) {
    console.error('[adminBookShiftForVolunteerAction]', err)
    return { success: false, error: 'Failed to book shift. Please try again.' }
  }
}

// ─── Admin: cancel a shift assignment ────────────────────────────────────────

export async function adminCancelShiftAssignmentAction(assignmentId: string): Promise<ActionResult> {
  try {
    await requireAdminSessionForShifts()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }

  try {
    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
    })

    if (!assignment) return { success: false, error: 'Assignment not found.' }

    await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { status: 'ADMIN_CANCELLED', cancelledAt: new Date() },
    })

    return { success: true }
  } catch (err) {
    console.error('[adminCancelShiftAssignmentAction]', err)
    return { success: false, error: 'Failed to cancel assignment. Please try again.' }
  }
}
