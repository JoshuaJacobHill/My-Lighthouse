import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Repeat, Download, Heart, Mail } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getDonorGifts, summariseGifts } from '@/lib/donations'
import { listMyRecurringGifts } from '@/lib/actions/recurring.actions'
import { formatDate } from '@/lib/utils'

// Colour a recurring badge by the plan's live Stripe status.
function statusTone(status: string): string {
  if (status === 'active' || status === 'trialing') return 'bg-green-50 text-green-700'
  if (status === 'canceled') return 'bg-gray-100 text-gray-600'
  return 'bg-amber-50 text-amber-700' // past_due / unpaid / paused
}

export const dynamic = 'force-dynamic'

export const metadata = { title: 'My giving' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

export default async function GivingHistoryPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const gifts = await getDonorGifts(session.userId)
  const summary = summariseGifts(gifts)

  // Live recurring plan statuses (from Stripe) so a historical recurring gift
  // shows whether its plan is now Active / Paused / Cancelled — a bare
  // "Recurring" tag wrongly implies it's still running. Matched by fund; with a
  // single plan we can match any recurring gift to it.
  const recurring = await listMyRecurringGifts()
  const recByFund = new Map<string, (typeof recurring)[number]>()
  for (const r of recurring) {
    const key = r.fundName ?? '__nofund__'
    if (!recByFund.has(key)) recByFund.set(key, r) // list is sorted active-first
  }
  const recStatusFor = (fundName: string | null) => {
    if (fundName && recByFund.has(fundName)) return recByFund.get(fundName)!
    if (recurring.length === 1) return recurring[0]
    return null
  }

  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } })
  const contactHref =
    'mailto:accounts@lighthousecare.org.au' +
    '?bcc=josh@lighthousecare.org.au' +
    '&subject=' +
    encodeURIComponent('Something missing from my giving history') +
    '&body=' +
    encodeURIComponent(
      `Hi Lighthouse Care team,\n\nI think something might be missing from my giving history` +
        (me?.email ? ` (account: ${me.email})` : '') +
        `.\n\nDetails:\n\n`
    )

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">My giving</h1>
      <p className="mt-1.5 text-gray-500">Every gift on your account, with receipts.</p>
      <Link
        href="/dashboard/recurring"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
      >
        <Repeat className="h-4 w-4" /> Manage recurring giving
      </Link>

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

          <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Gift</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((g) => {
                  const cadence = g.frequency && g.frequency !== 'One-off' ? g.frequency : g.isRecurring ? 'Recurring' : null
                  const rec = cadence ? recStatusFor(g.fundName) : null
                  const recTone = rec ? statusTone(rec.status) : 'bg-orange-50 text-orange-600'
                  const primary = g.description ?? g.fundName ?? 'Donation'
                  const secondary = g.fundName && g.fundName !== primary ? g.fundName : null
                  return (
                    <tr key={g.id} className="border-b border-gray-100 last:border-0 align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-gray-700">{formatDate(g.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{primary}</span>
                          {cadence && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${recTone}`}>
                              <Repeat className="h-3 w-3" /> {cadence}
                              {rec ? ` · ${rec.statusLabel}` : ''}
                            </span>
                          )}
                        </div>
                        {secondary && <p className="mt-0.5 text-xs text-gray-400">{secondary}</p>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-gray-600">{g.paymentMethod ?? '—'}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-900">
                        {aud.format(g.amount)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {g.taxReceiptEligible ? (
                          <Link
                            href={`/dashboard/receipts/${g.id}`}
                            className="inline-flex items-center gap-1 font-medium text-orange-600 hover:text-orange-700"
                          >
                            <Download className="h-3.5 w-3.5" /> View
                          </Link>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Anything missing? */}
          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium text-gray-900">Anything missing?</p>
              <p className="mt-0.5 text-sm text-gray-500">
                If a gift isn&rsquo;t showing here, let us know and we&rsquo;ll sort it out.
              </p>
            </div>
            <a
              href={contactHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <Mail className="h-4 w-4" /> Contact us
            </a>
          </div>
        </>
      )}
    </div>
  )
}
