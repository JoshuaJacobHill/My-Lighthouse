import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, Receipt, TrendingUp } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import {
  claimDonationsForUser,
  getDonorGifts,
  summariseGifts,
} from '@/lib/donations'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'My Giving — Lighthouse Care' }

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
    select: { name: true, email: true, emailVerified: true },
  })
  if (!user) redirect('/login')

  // Pull in any gifts made with this (verified) email before the account existed.
  await claimDonationsForUser(session.userId, user.email, user.emailVerified)

  const gifts = await getDonorGifts(session.userId)
  const summary = summariseGifts(gifts)
  const live = isDonorPortalEnabled()
  const firstName = user.name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {!live && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Preview mode.</strong> The donor portal is hidden from volunteers
          and the public while it&rsquo;s being built. You can see it because
          you&rsquo;re an admin or on the early-access list.
        </div>
      )}

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">My Giving</h1>
        <p className="mt-2 text-lg text-gray-500">
          Thank you, {firstName}, for standing with families doing it tough across
          South East Queensland.
        </p>
      </div>

      {gifts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Heart className="mx-auto h-8 w-8 text-orange-400" />
          <p className="mt-3 text-gray-600">No gifts on your account yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            When you give, your history and receipts will appear here.
          </p>
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

          <h2 className="mb-3 mt-10 text-lg font-semibold text-gray-900">Your gifts</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
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
