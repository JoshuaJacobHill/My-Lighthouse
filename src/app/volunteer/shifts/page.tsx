import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import ShiftsClient from './ShiftsClient'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Shifts',
}

export default async function ShiftsPage() {
  const session = await getSession()
  if (!session?.volunteerId) redirect('/login')

  const rangeStart = new Date()
  rangeStart.setMonth(rangeStart.getMonth() - 2)
  rangeStart.setDate(1)
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 12)

  const [locations, rawAssignments] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true, name: { in: ['Loganholme Store', 'Hillcrest Store'] } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.shiftAssignment.findMany({
      where: {
        volunteerId: session.volunteerId,
        status: { in: ['SCHEDULED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED_BY_VOLUNTEER'] },
        shift: { date: { gte: rangeStart, lte: rangeEnd } },
      },
      include: { shift: { include: { location: true } } },
      orderBy: { shift: { startTime: 'asc' } },
    }),
  ])

  const assignments = rawAssignments.map((a) => ({
    id: a.id,
    status: a.status,
    cancelReason: a.cancelReason,
    shift: {
      id: a.shift.id,
      date: a.shift.date.toISOString(),
      startTime: a.shift.startTime.toISOString(),
      endTime: a.shift.endTime.toISOString(),
      location: { id: a.shift.location.id, name: a.shift.location.name },
    },
  }))

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">My shifts</h1>
          <p className="mt-1.5 text-neutral-500">Your volunteering schedule with Lighthouse Care.</p>
        </div>
        <ShiftsClient
          assignments={assignments}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  )
}
