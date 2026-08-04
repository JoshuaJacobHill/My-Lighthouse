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
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">My availability</h1>
          <p className="mt-1.5 text-neutral-500">
            Let us know which sessions generally work for you — tick as many as you like. We&apos;ll use this to match you to shifts that suit your schedule.
          </p>
        </div>
        <div className="mb-6 rounded-2xl bg-orange-50 p-5 text-sm text-orange-900">
          <p className="mb-1 font-semibold">Our trading hours:</p>
          <ul className="list-none space-y-0.5 text-orange-800">
            <li>Loganholme Store: Mon–Fri 9am–5pm, Sat 9am–4pm</li>
            <li>Hillcrest Store: Mon–Fri 9am–5pm, Sat 9am–12pm</li>
            <li>We are closed Sundays</li>
          </ul>
        </div>
        <AvailabilityEditorClient initialAvailability={initialAvailability} />
      </div>
    </div>
  )
}
