import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Repeat, Download, Heart } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { getDonorGifts, summariseGifts } from '@/lib/donations'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'My giving' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

export default async function GivingHistoryPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const gifts = await getDonorGifts(session.userId)
  const summary = summariseGifts(gifts)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/donor"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">My giving</h1>
      <p className="mt-1.5 text-gray-500">Every gift on your account, with receipts.</p>

      {gifts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Heart className="mx-auto h-8 w-8 text-orange-400" />
          <p className="mt-3 text-gray-600">No gifts on your account yet.</p>
          <Link
            href="/donate"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Make a donation
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-2xl font-bold tabular-nums text-gray-900">{aud0.format(summary.allTime)}</p>
              <p className="mt-1 text-sm text-gray-500">All-time</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-2xl font-bold tabular-nums text-gray-900">{aud0.format(summary.financialYear)}</p>
              <p className="mt-1 text-sm text-gray-500">This FY ({summary.fyLabel})</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-2xl font-bold tabular-nums text-gray-900">{summary.count}</p>
              <p className="mt-1 text-sm text-gray-500">Gifts</p>
            </div>
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
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                          <Repeat className="h-3 w-3" /> Recurring
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
                          className="inline-flex items-center gap-1 font-medium text-orange-600 hover:text-orange-700"
                        >
                          <Download className="h-3.5 w-3.5" /> View
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
