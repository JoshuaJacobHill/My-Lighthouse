import Link from 'next/link'
import { Plus, Pencil, Users } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Events | Lighthouse Care Admin' }

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { startsAt: 'desc' },
    select: {
      id: true,
      title: true,
      startsAt: true,
      venue: true,
      isPublished: true,
      _count: { select: { ticketTypes: true, orders: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Create events with free or paid tickets. Proceeds can be allocated to a fund.
          </p>
        </div>
        <Link href="/admin/events/new">
          <Button>
            <Plus className="h-4 w-4" /> New event
          </Button>
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            No events yet. Create one — for example the Good Food Festival — with free RSVP and/or
            paid tickets.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3 text-center">Ticket types</th>
                <th className="px-5 py-3 text-center">Orders</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{ev.title}</span>
                      {ev.isPublished ? (
                        <Badge variant="ACTIVE">Published</Badge>
                      ) : (
                        <Badge variant="INACTIVE">Draft</Badge>
                      )}
                    </div>
                    {ev.venue && <p className="mt-0.5 text-xs text-gray-400">{ev.venue}</p>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{ev.startsAt ? formatDateTime(ev.startsAt) : 'TBA'}</td>
                  <td className="px-5 py-3 text-center tabular-nums text-gray-600">{ev._count.ticketTypes}</td>
                  <td className="px-5 py-3 text-center tabular-nums text-gray-600">{ev._count.orders}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/admin/events/${ev.id}/attendees`} className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-600">
                        <Users className="h-4 w-4" /> Attendees
                      </Link>
                      <Link href={`/admin/events/${ev.id}/edit`} className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-600">
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
