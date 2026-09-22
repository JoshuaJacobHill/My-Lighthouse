import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Ticket as TicketIcon } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { claimTicketOrdersForUser } from '@/lib/tickets'
import { connectionsFromSession, eventAudienceWhere } from '@/lib/audience'
import { formatEventWhen } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My tickets' }

/**
 * Tickets on this account.
 *
 * Lives under Account rather than the main nav: most people here never buy a
 * ticket, and a permanent tab for something you use twice a year is clutter on
 * a phone.
 *
 * Orders are claimed on the way in. Somebody who bought before they had an
 * account — or while signed out — has their tickets matched to them by verified
 * email, which is the same way giving history follows a person in.
 */
export default async function MyTicketsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, emailVerified: true },
  })
  if (me) await claimTicketOrdersForUser(session.userId, me.email, me.emailVerified)

  const orders = await prisma.ticketOrder.findMany({
    where: { userId: session.userId, status: 'CONFIRMED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      event: { select: { slug: true, title: true, startsAt: true, endsAt: true, venue: true } },
      tickets: { select: { id: true, reference: true }, orderBy: { reference: 'asc' } },
    },
  })

  // Only for the empty state, and only events this person may actually see.
  const upcoming = orders.length
    ? []
    : await prisma.event.findMany({
        where: {
          isPublished: true,
          OR: [{ startsAt: { gte: new Date() } }, { startsAt: null }],
          AND: [eventAudienceWhere(connectionsFromSession(session.user))],
        },
        orderBy: { startsAt: 'asc' },
        take: 3,
        select: { id: true, slug: true, title: true, startsAt: true, endsAt: true, venue: true },
      })

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/account"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Account
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">My tickets</h1>

        {orders.length === 0 ? (
          <>
            <div className="mt-6 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
              <TicketIcon className="mx-auto h-8 w-8 text-orange-400" aria-hidden="true" />
              <p className="mt-3 font-semibold text-neutral-900">No tickets</p>
            </div>

            {upcoming.length > 0 && (
              <>
                <h2 className="mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">
                  Coming up
                </h2>
                <div className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
                  {upcoming.map((e) => (
                    <Link
                      key={e.id}
                      href={`/events/${e.slug}`}
                      className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-neutral-50"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-neutral-900">{e.title}</span>
                        <span className="block truncate text-sm text-neutral-500">
                          {formatEventWhen(e.startsAt, e.endsAt)}
                          {e.venue ? ` · ${e.venue}` : ''}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="rounded-[28px] border border-neutral-200 p-5">
                <Link href={`/events/${o.event.slug}`} className="group flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-neutral-900 group-hover:underline">
                      {o.event.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {formatEventWhen(o.event.startsAt, o.event.endsAt)}
                    </span>
                    {o.event.venue && (
                      <span className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {o.event.venue}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-neutral-300 group-hover:text-neutral-500"
                    aria-hidden="true"
                  />
                </Link>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                  {o.tickets.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs text-neutral-700"
                    >
                      {t.reference}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
