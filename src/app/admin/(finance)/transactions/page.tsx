import prisma from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { financialYearRange } from '@/lib/donations'
import { STRIPE_ACCOUNTS } from '@/lib/stripe-accounts'
import { AttendeesCsvButton } from '@/components/admin/AttendeesCsvButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Transactions | Lighthouse Care Admin' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

const SOURCE_LABEL: Record<string, string> = {
  DONATE_PAGE: 'Donate page',
  FUNDRAISER: 'Fundraiser',
  WORDPRESS_FORM: 'Website form',
  APPEAL_LINK: 'Appeal link',
  EVENT: 'Event',
  OFFLINE: 'Offline',
}

function accountLabel(key: string | null | undefined): string {
  return (key && (STRIPE_ACCOUNTS as Record<string, { label: string }>)[key]?.label) || 'Lighthouse Care'
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export default async function TransactionsPage() {
  const { start, end, label: fyLabel } = financialYearRange()

  const [totals, fyAgg, rows] = await Promise.all([
    prisma.donation.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.donation.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        createdAt: true,
        donorName: true,
        donorEmail: true,
        amount: true,
        source: true,
        provider: true,
        userId: true,
        fund: { select: { name: true, depositAccount: true } },
        fundraiser: { select: { title: true } },
      },
    }),
  ])

  const allTime = Number(totals._sum.amount ?? 0)
  const fyTotal = Number(fyAgg._sum.amount ?? 0)

  const csv = [
    ['Date', 'Name', 'Email', 'Amount', 'Fund', 'Fundraiser', 'Source', 'Account', 'Provider'].join(','),
    ...rows.map((r) =>
      [
        formatDate(r.createdAt),
        r.donorName ?? '',
        r.donorEmail ?? '',
        Number(r.amount).toFixed(2),
        r.fund?.name ?? '',
        r.fundraiser?.title ?? '',
        SOURCE_LABEL[r.source] ?? r.source,
        accountLabel(r.fund?.depositAccount),
        r.provider,
      ]
        .map((v) => csvCell(String(v)))
        .join(',')
    ),
  ].join('\n')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-0.5 text-sm text-gray-500">Every gift received, across all funds, fundraisers and events.</p>
        </div>
        {rows.length > 0 && <AttendeesCsvButton csv={csv} filename={`transactions-${new Date().toISOString().slice(0, 10)}.csv`} />}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="All-time received" value={aud0.format(allTime)} />
        <Stat label={`This financial year (${fyLabel})`} value={aud0.format(fyTotal)} />
        <Stat label="Gifts" value={String(totals._count)} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No donations yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Donor</th>
                <th className="px-4 py-3">For</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{r.donorName || 'Anonymous'}</span>
                    {r.donorEmail && <p className="text-xs text-gray-400">{r.donorEmail}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.fundraiser?.title ?? r.fund?.name ?? 'General'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{SOURCE_LABEL[r.source] ?? r.source}</td>
                  <td className="px-4 py-3 text-gray-500">{accountLabel(r.fund?.depositAccount)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{aud.format(Number(r.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 1000 && (
        <p className="text-xs text-gray-400">Showing the most recent 1,000 gifts. Export CSV for the full set within this range.</p>
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
