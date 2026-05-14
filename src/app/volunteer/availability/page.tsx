import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import AvailabilityEditorClient from './AvailabilityEditorClient'
import type { Metadata } from 'next'
import type { AvailabilityRanges, DayOfWeek } from '@/components/volunteer/AvailabilityGrid'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Availability',
}

export default async function AvailabilityPage() {
  const session = await getSession()
  if (!session?.volunteerId) redirect('/login')

  const records = await prisma.volunteerAvailability.findMany({
    where: { volunteerId: session.volunteerId },
    orderBy: { startTime: 'asc' },
  })

  // Convert DB records to AvailabilityRanges format
  const initialAvailability: AvailabilityRanges = {}
  for (const record of records) {
    const day = record.dayOfWeek as DayOfWeek
    if (!initialAvailability[day]) initialAvailability[day] = []
    initialAvailability[day]!.push({
      startTime: record.startTime,
      endTime: record.endTime,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tell us which days and times work for you — even a 30-minute slot helps. We&apos;ll use this to find shifts that suit you best.
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
      <AvailabilityEditorClient initialAvailability={initialAvailability} />
    </div>
  )
}
