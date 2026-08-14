import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, MapPin, Ticket as TicketIcon, CheckCircle2 } from 'lucide-react'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'You’re registered — Lighthouse Care', robots: { index: false } }

async function findOrderId(
  orderParam: string | undefined,
  sessionId: string | undefined
): Promise<{ orderId: string | null; pending: boolean }> {
  if (orderParam) return { orderId: orderParam, pending: false }
  if (sessionId && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId)
      const pi =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      if (pi) {
        const order = await prisma.ticketOrder.findUnique({
          where: { providerTransactionId: pi },
          select: { id: true },
        })
        // Paid but webhook may not have landed yet → show a pending message.
        return { orderId: order?.id ?? null, pending: !order }
      }
    } catch {
      // fall through
    }
  }
  return { orderId: null, pending: false }
}

export default async function RegisteredPage({
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ order?: string; session_id?: string }>
}) {
  if (!isDonorPortalEnabled()) notFound()

  const { order: orderParam, session_id: sessionId } = await searchParams
  const { orderId, pending } = await findOrderId(orderParam, sessionId)

  const order = orderId
    ? await prisma.ticketOrder.findUnique({
        where: { id: orderId },
        select: {
          purchaserName: true,
          event: { select: { title: true, venue: true, startsAt: true } },
          tickets: {
            orderBy: { reference: 'asc' },
            select: { reference: true, ticketType: { select: { name: true } } },
          },
        },
      })
    : null

  const firstName = order?.purchaserName?.split(' ')[0]

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            You&rsquo;re registered{firstName ? `, ${firstName}` : ''}!
          </h1>
        </div>

        {order ? (
          <>
            <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{order.event.title}</p>
              <p className="mt-1 inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-orange-500" /> {order.event.startsAt ? formatDateTime(order.event.startsAt) : 'Date to be advised'}
              </p>
              {order.event.venue && (
                <p className="mt-1 inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-orange-500" /> {order.event.venue}
                </p>
              )}
            </div>

            <h2 className="mt-6 mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <TicketIcon className="h-4 w-4 text-orange-500" /> Your {order.tickets.length === 1 ? 'ticket' : 'tickets'}
            </h2>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {order.tickets.map((t) => (
                <li key={t.reference} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-700">{t.ticketType.name}</span>
                  <span className="font-mono font-semibold text-gray-900">{t.reference}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-gray-500">
              We&rsquo;ve emailed these to you as well — bring your reference {order.tickets.length === 1 ? 'code' : 'codes'} to the door.
            </p>
          </>
        ) : pending ? (
          <p className="mt-6 text-center text-gray-600">
            Payment received — we&rsquo;re confirming your tickets now and will email them to you shortly.
          </p>
        ) : (
          <p className="mt-6 text-center text-gray-600">
            Thank you for registering. Your tickets will be emailed to you.
          </p>
        )}

        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-sm font-medium text-orange-600 hover:text-orange-700">
            Go to my account →
          </Link>
        </div>
      </div>
    </div>
  )
}
