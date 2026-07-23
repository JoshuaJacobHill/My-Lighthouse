import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, Receipt, TrendingUp, HandHeart, ArrowRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import {
  claimDonationsForUser,
  getDonorGifts,
  summariseGifts,
} from '@/lib/donations'
import { formatDate, statusLabel, statusColour } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'My Lighthouse Care' }

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export default async function DonorHomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      volunteerProfile: { select: { id: true, status: true } },
    },
  })
  if (!user) redirect('/login')

  await claimDonationsForUser(session.userId, user.email, user.emailVerified)

  const gifts = await getDonorGifts(session.userId)
  const summary = summariseGifts(gifts)
  const live = isDonorPortalEnabled()
  const firstName = user.name?.split(' ')[0] ?? 'there'
  const isVolunteer = Boolean(user.volunteerProfile)

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {!live && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Preview mode.</strong> The donor portal is hidden from volunteers
          and the public while it&rsquo;s being built. You can see it because
          you&rsquo;re an admin or on the early-access list.
        </div>
      )}

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {firstName}</h1>
        <p className="mt-2 text-lg text-gray-500">
          Thank you for standing with families doing it tough across South East
          Queensland.
        </p>
      </div>

      {/* ── My giving ─────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">My giving</h2>

        {gifts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-orange-400" />
            <p className="mt-3 text-gray-600">No gifts on your account yet.</p>
            <Link
              href="/donate"
              className="mt-5 inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Make a donation
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard
                icon={<TrendingUp className="h-5 w-5" />}
                label={`This financial year (${summary.fyLabel})`}
                value={aud.format(summary.financialYear)}
              />
              <SummaryCard
                icon={<Heart className="h-5 w-5" />}
                label="All-time giving"
                value={aud.format(summary.allTime)}
              />
              <SummaryCard
                icon={<Receipt className="h-5 w-5" />}
                label="Gifts"
                value={String(summary.count)}
              />
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Fund</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {gifts.map((g) => (
                    <tr key={g.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-3 text-gray-700">{formatDate(g.createdAt)}</td>
                      <td className="px-5 py-3 text-gray-700">
                        {g.fundName ?? 'General'}
                        {g.isRecurring && (
                          <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                            Monthly
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-900">
                        {aud.format(g.amount)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {g.taxReceiptEligible ? (
                          <Link
                            href={`/donor/receipts/${g.id}`}
                            className="font-medium text-orange-600 hover:text-orange-700"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── My volunteering ───────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">My volunteering</h2>
        {isVolunteer ? (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <HandHeart className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold text-gray-900">You volunteer with us</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  Status:{' '}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColour(
                      user.volunteerProfile!.status
                    )}`}
                  >
                    {statusLabel(user.volunteerProfile!.status)}
                  </span>
                </p>
              </div>
            </div>
            <Link
              href="/volunteer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go to volunteer portal <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50/50 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm">
                <HandHeart className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold text-gray-900">Would you like to volunteer too?</p>
                <p className="mt-0.5 text-sm text-gray-600">
                  Give your time alongside your generosity — join the team behind the mission.
                </p>
              </div>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Become a volunteer <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
        {icon}
      </span>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  )
}
