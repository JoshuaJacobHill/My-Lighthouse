import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import AvailabilityEditorClient from './AvailabilityEditorClient'
import type { Metadata } from 'next'
import type { AvailabilityPeriodMap, DayOfWeek, AvailabilityPeriodKey } from '@/components/volunteer/AvailabilityCheckboxGrid'

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

  // Convert DB records to AvailabilityPeriodMap using the timePeriod field
  const initialAvailability: AvailabilityPeriodMap = {}
  for (const record of records) {
    const day = record.dayOfWeek as DayOfWeek
    const period = record.timePeriod as AvailabilityPeriodKey
    if (!['PRE_OPEN', 'MORNING', 'AFTERNOON'].includes(period)) continue
    if (!initialAvailability[day]) initialAvailability[day] = []
    if (!initialAvailability[day]!.includes(period)) {
      initialAvailability[day]!.push(period)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Let us know which sessions generally work for you — tick as many as you like. We&apos;ll use this to match you to shifts that suit your schedule.
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
