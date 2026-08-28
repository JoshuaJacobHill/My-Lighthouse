import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requireCapability } from '@/lib/permissions'
import { ScheduleAdmin } from './ScheduleAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Wellbeing schedule | Lighthouse Care Admin' }

export default async function SchedulePage() {
  await requireCapability('care.people')

  const sessions = await prisma.wellbeingSession.findMany({
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      title: true,
      weekday: true,
      startTime: true,
      endTime: true,
      location: true,
      leader: true,
      notes: true,
      isActive: true,
    },
  })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Wellbeing schedule</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          The weekly sessions staff see on the fitness challenge page.
        </p>
      </div>
      <ScheduleAdmin sessions={sessions} />
    </div>
  )
}
