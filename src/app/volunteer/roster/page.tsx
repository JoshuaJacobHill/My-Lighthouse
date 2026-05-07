import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import RosterClient from './RosterClient'
import { addDays, startOfWeek, format, addWeeks } from 'date-fns'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Book a Shift',
}

export default async function RosterPage() {
  const session = await getSession()
  if (!session?.volunteerId) redirect('/login')

  const volunteerId = session.volunteerId
  const now = new Date()
  const fourWeeksOut = addDays(now, 28)

  // Fetch upcoming shifts that are active, within the next 4 weeks
  // Only show store locations — not Warehouse, Home Delivery, etc.
  const STORE_LOCATIONS = ['Loganholme Store', 'Hillcrest Store']

  const [allShifts, volunteerAssignments] = await Promise.all([
    prisma.shift.findMany({
      where: {
        isActive: true,
        date: { gte: now, lte: fourWeeksOut },
        location: { name: { in: STORE_LOCATIONS } },
      },
      include: {
        location: true,
        assignments: {
          where: { status: { in: ['SCHEDULED', 'CONFIRMED', 'ATTENDED'] } },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.shiftAssignment.findMany({
      where: {
        volunteerId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        shift: {
          date: { gte: now },
          location: { name: { in: STORE_LOCATIONS } },
        },
      },
      include: {
        shift: { include: { location: true } },
      },
      orderBy: { shift: { date: 'asc' } },
    }),
  ])

  // Build a set of shiftIds the volunteer has already booked (active)
  const bookedShiftIds = new Set(volunteerAssignments.map((a) => a.shiftId))

  // Filter shifts where volunteer is NOT already booked and shift is not full
  const availableShifts = allShifts.filter((shift) => {
    if (bookedShiftIds.has(shift.id)) return false
    return true // Show all, including full (UI will disable button)
  })

  // Group available shifts by week
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const ws = addWeeks(weekStart, i)
    const we = addDays(ws, 6)
    return {
      start: ws,
      end: we,
      weekLabel: `Week of ${format(ws, 'd MMM')}`,
    }
  })

  const availableWeeks = weeks.map((week) => ({
    weekLabel: week.weekLabel,
    shifts: availableShifts
      .filter((shift) => {
        const d = new Date(shift.date)
        return d >= week.start && d <= week.end
      })
      .map((shift) => ({
        id: shift.id,
        date: shift.date.toISOString(),
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
        location: shift.location.name,
        title: shift.title ?? null,
        notes: shift.notes ?? null,
        capacity: shift.capacity,
        filledCount: shift.assignments.length,
      })),
  }))

  // Booked shifts for this volunteer
  const bookedShifts = volunteerAssignments.map((a) => ({
    assignmentId: a.id,
    shiftId: a.shiftId,
    date: a.shift.date.toISOString(),
    startTime: a.shift.startTime.toISOString(),
    endTime: a.shift.endTime.toISOString(),
    location: a.shift.location.name,
    title: a.shift.title ?? null,
    status: a.status,
  }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Book a Shift</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse upcoming shifts and book yourself in. No approval needed — just pick a time that works for you.
        </p>
      </div>

      <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
        <p className="font-semibold mb-1">Our trading hours:</p>
        <ul className="space-y-0.5 list-none">
          <li>Loganholme Store: Mon–Fri 9am–5pm, Sat 9am–4pm</li>
          <li>Hillcrest Store: Mon–Fri 9am–5pm, Sat 9am–12pm</li>
          <li>We are closed Sundays</li>
        </ul>
      </div>

      <RosterClient availableWeeks={availableWeeks} bookedShifts={bookedShifts} />
    </div>
  )
}
