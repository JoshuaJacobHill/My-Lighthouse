import { CheckCircle2 } from 'lucide-react'
import prisma from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { AttendeesCsvButton } from '@/components/admin/AttendeesCsvButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Donors | Lighthouse Care Admin' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

type Donor = {
  key: string
  name: string
  email: string
  total: number
  count: number
  last: Date
  hasAccount: boolean
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export default async function DonorsPage() {
  // Aggregate gifts into donors. Key by email where present (online gifts), else
  // by name (offline/business gifts often have no email).
  const gifts = await prisma.donation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: { donorName: true, donorEmail: true, amount: true, createdAt: true, userId: true },
  })

  const map = new Map<string, Donor>()
  for (const g of gifts) {
    const email = (g.donorEmail ?? '').trim().toLowerCase()
    const key = email || (g.donorName ?? '').trim().toLowerCase() || 'anonymous'
    const existing = map.get(key)
    if (existing) {
      existing.total += Number(g.amount)
      existing.count += 1
      if (g.createdAt > existing.last) existing.last = g.createdAt
      if (g.userId) existing.hasAccount = true
      if (!existing.name && g.donorName) existing.name = g.donorName
    } else {
      map.set(key, {
        key,
        name: g.donorName ?? 'Anonymous',
        email: g.donorEmail ?? '',
        total: Number(g.amount),
        count: 1,
        last: g.createdAt,
        hasAccount: Boolean(g.userId),
      })
    }
  }

  const donors = [...map.values()].sort((a, b) => b.total - a.total)
  const grandTotal = donors.reduce((s, d) => s + d.total, 0)

  const csv = [
    ['Donor', 'Email', 'Total given', 'Gifts', 'Last gift', 'Has account'].join(','),
    ...donors.map((d) =>
      [d.name, d.email, d.total.toFixed(2), String(d.count), formatDate(d.last), d.hasAccount ? 'Yes' : 'No']
        .map((v) => csvCell(String(v)))
        .join(',')
    ),
  ].join('\n')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donors</h1>
          <p className="mt-0.5 text-sm text-gray-500">Everyone who has given, with their total and most recent gift.</p>
        </div>
        {donors.length > 0 && <AttendeesCsvButton csv={csv} filename={`donors-${new Date().toISOString().slice(0, 10)}.csv`} />}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Donors" value={String(donors.length)} />
        <Stat label="Total given" value={aud0.format(grandTotal)} />
      </div>

      {donors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No donors yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Donor</th>
                <th className="px-4 py-3 text-center">Gifts</th>
                <th className="px-4 py-3">Last gift</th>
                <th className="px-4 py-3 text-center">Account</th>
                <th className="px-4 py-3 text-right">Total given</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((d) => (
                <tr key={d.key} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{d.name || 'Anonymous'}</span>
                    {d.email && <p className="text-xs text-gray-400">{d.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-gray-600">{d.count}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(d.last)}</td>
                  <td className="px-4 py-3 text-center">
                    {d.hasAccount ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" aria-label="Has an account" />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">{aud.format(d.total)}</td>
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
