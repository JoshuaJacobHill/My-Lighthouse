import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { EventForm } from '@/components/admin/EventForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'New event | Lighthouse Care Admin' }

export default async function NewEventPage() {
  const funds = await prisma.fund.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New event</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Add the details and at least one ticket type. Set a price of $0 for free / RSVP tickets.
        </p>
      </div>
      <EventForm funds={funds} />
    </div>
  )
}
