import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import RosterClient from './RosterClient'
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

  const STORE_LOCATIONS = ['Loganholme Store', 'Hillcrest Store']

  const [locations, volunteerAssignments] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true, name: { in: STORE_LOCATIONS } },
      orderBy: { sortOrder: 'asc' },
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
          Choose your location, date, and times — no approval needed. Just pick what works for you.
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

      <RosterClient
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        bookedShifts={bookedShifts}
      />
    </div>
  )
}
