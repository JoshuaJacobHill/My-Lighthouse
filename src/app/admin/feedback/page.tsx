import { redirect } from 'next/navigation'
import { Star, MessageSquare } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { isAdminRole } from '@/lib/permissions-core'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Volunteer Feedback | Lighthouse Care Admin' }

export default async function FeedbackAdminPage() {
  await requireCapability('care.people')
  const session = await getSession()
  if (!session || !isAdminRole(session.role)) redirect('/login')

  const [rated, agg, withComments] = await Promise.all([
    prisma.shiftFeedback.findMany({
      where: { rating: { not: null } },
      orderBy: { ratedAt: 'desc' },
      take: 60,
      select: {
        id: true,
        rating: true,
        comment: true,
        ratedAt: true,
        volunteer: { select: { firstName: true, lastName: true, preferredLocations: true } },
      },
    }),
    prisma.shiftFeedback.aggregate({ where: { rating: { not: null } }, _avg: { rating: true }, _count: true }),
    prisma.shiftFeedback.count({ where: { comment: { not: null } } }),
  ])

  const avg = agg._avg.rating
  const sent = await prisma.shiftFeedback.count()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Volunteer feedback</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Ratings volunteers give after signing out. Anything they write comes here and to the coordinator by reply.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label="Average rating" value={avg ? `${avg.toFixed(1)} / 5` : '—'} />
        <Stat label="Ratings received" value={String(agg._count)} />
        <Stat label="With a comment" value={String(withComments)} />
        <Stat label="Response rate" value={sent ? `${Math.round((agg._count / sent) * 100)}%` : '—'} />
      </div>

      {rated.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Star className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No ratings yet — they start arriving once volunteers sign out at the kiosk.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Volunteer</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3">Comment</th>
              </tr>
            </thead>
            <tbody>
              {rated.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                    {r.ratedAt ? formatDateTime(r.ratedAt) : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-900">
                    {r.volunteer.firstName} {r.volunteer.lastName}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{r.volunteer.preferredLocations?.[0] ?? '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className={r.rating && r.rating <= 2 ? 'font-semibold text-red-600' : 'text-amber-500'}>
                      {'★'.repeat(r.rating ?? 0)}
                      <span className="text-gray-200">{'★'.repeat(5 - (r.rating ?? 0))}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {r.comment ? (
                      <span className="inline-flex items-start gap-1.5">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {r.comment}
                      </span>
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
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  )
}
