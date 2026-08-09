import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { formatDate, formatDateTime } from '@/lib/utils'
import { AttendeesCsvButton } from '@/components/admin/AttendeesCsvButton'
import { EventSponsorsManager } from '@/components/admin/EventSponsorsManager'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Attendees | Lighthouse Care Admin' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

function csvCell(value: string): string {
  // Always quote and escape embedded quotes — safe for names/emails with commas.
  return `"${value.replace(/"/g, '""')}"`
}

export default async function AttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      title: true,
      startsAt: true,
      venue: true,
      capacity: true,
      sponsors: {
        orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, businessName: true, tier: true, amount: true, logoUrl: true, paid: true },
      },
      orders: {
        where: { status: 'CONFIRMED' },
        orderBy: { createdAt: 'asc' },
        select: {
          purchaserName: true,
          purchaserEmail: true,
          amountTotal: true,
          createdAt: true,
          tickets: {
            select: {
              reference: true,
              attendeeName: true,
              checkedInAt: true,
              ticketType: { select: { name: true } },
            },
          },
        },
      },
    },
  })
  if (!event) notFound()

  // Flatten to one row per ticket (each ticket is an attendee slot).
  const rows = event.orders.flatMap((o) =>
    o.tickets.map((t) => ({
      reference: t.reference,
      ticketType: t.ticketType.name,
      name: t.attendeeName || o.purchaserName,
      email: o.purchaserEmail,
      orderedAt: o.createdAt,
      checkedIn: t.checkedInAt,
    }))
  )

  const totalTickets = rows.length
  const totalRevenue = event.orders.reduce((sum, o) => sum + Number(o.amountTotal), 0)
  const checkedIn = rows.filter((r) => r.checkedIn).length

  const csv = [
    ['Reference', 'Ticket type', 'Name', 'Email', 'Ordered', 'Checked in'].join(','),
    ...rows.map((r) =>
      [
        r.reference,
        r.ticketType,
        r.name,
        r.email,
        formatDate(r.orderedAt),
        r.checkedIn ? formatDateTime(r.checkedIn) : '',
      ]
        .map((v) => csvCell(String(v)))
        .join(',')
    ),
  ].join('\n')

  const csvFilename = `attendees-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.csv`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendees</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {event.title} · {formatDateTime(event.startsAt)}
              {event.venue ? ` · ${event.venue}` : ''}
            </p>
          </div>
          {rows.length > 0 && <AttendeesCsvButton csv={csv} filename={csvFilename} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={event.capacity ? `Tickets (of ${event.capacity})` : 'Tickets'} value={String(totalTickets)} />
        <StatCard label="Checked in" value={`${checkedIn} / ${totalTickets}`} />
        <StatCard label="Revenue" value={aud.format(totalRevenue)} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No registrations yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Ticket</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Ordered</th>
                <th className="px-5 py-3 text-center">Checked in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reference} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{r.reference}</td>
                  <td className="px-5 py-3 text-gray-700">{r.ticketType}</td>
                  <td className="px-5 py-3 text-gray-900">{r.name}</td>
                  <td className="px-5 py-3 text-gray-600">{r.email}</td>
                  <td className="px-5 py-3 text-gray-600">{formatDate(r.orderedAt)}</td>
                  <td className="px-5 py-3 text-center">
                    {r.checkedIn ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EventSponsorsManager
        eventId={id}
        sponsors={event.sponsors.map((s) => ({
          id: s.id,
          businessName: s.businessName,
          tier: s.tier,
          amount: Number(s.amount),
          logoUrl: s.logoUrl,
          paid: s.paid,
        }))}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  )
}
