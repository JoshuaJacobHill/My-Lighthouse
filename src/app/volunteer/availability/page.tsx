import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import AvailabilityEditorClient from './AvailabilityEditorClient'
import type { Metadata } from 'next'
import type { AvailabilityMap } from '@/components/volunteer/AvailabilityGrid'
import { getTimePeriodConfig } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Availability',
}

export default async function AvailabilityPage() {
  const session = await getSession()
  if (!session?.volunteerId) redirect('/login')

  const [records, availabilitySettings] = await Promise.all([
    prisma.volunteerAvailability.findMany({
      where: { volunteerId: session.volunteerId },
    }),
    prisma.appSetting.findMany({
      where: { key: { startsWith: 'availability_' } },
    }),
  ])

  // Convert DB records to the AvailabilityMap format the grid expects
  const initialAvailability: AvailabilityMap = {}
  for (const record of records) {
    const day = record.dayOfWeek as keyof AvailabilityMap
    if (!initialAvailability[day]) {
      initialAvailability[day] = {}
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(initialAvailability[day] as any)[record.timePeriod] = true
  }

  const settingsMap = Object.fromEntries(availabilitySettings.map((s) => [s.key, s.value]))
  const timePeriods = getTimePeriodConfig(settingsMap)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Let us know which days and times generally work for you. We&apos;ll use this to find shifts that suit you best.
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
      <AvailabilityEditorClient initialAvailability={initialAvailability} timePeriods={timePeriods} />
    </div>
  )
}
