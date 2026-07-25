import Link from 'next/link'
import { Plus, Pencil, ExternalLink } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Fundraisers | Lighthouse Care Admin' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
}

export default async function FundraisersPage() {
  const fundraisers = await prisma.fundraiser.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, slug: true, organiserName: true, goalAmount: true, isActive: true },
  })

  const sums = await prisma.donation.groupBy({ by: ['fundraiserId'], _sum: { amount: true } })
  const raisedByFundraiser = new Map<string, number>()
  for (const s of sums) if (s.fundraiserId) raisedByFundraiser.set(s.fundraiserId, Number(s._sum.amount ?? 0))

  const base = baseUrl()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fundraisers</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            GoFundMe-style pages for partners and appeals. Proceeds roll up to a fund; import existing
            donors as offline gifts so their progress carries over.
          </p>
        </div>
        <Link href="/admin/fundraisers/new">
          <Button>
            <Plus className="h-4 w-4" /> New fundraiser
          </Button>
        </Link>
      </div>

      {fundraisers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No fundraisers yet. Create one — for example a partner page like JCK Construction.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Fundraiser</th>
                <th className="px-5 py-3 text-right">Raised</th>
                <th className="px-5 py-3 text-right">Goal</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fundraisers.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{f.title}</span>
                      {f.isActive ? <Badge variant="ACTIVE">Active</Badge> : <Badge variant="INACTIVE">Inactive</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">by {f.organiserName}</p>
                  </td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-gray-900">
                    {aud.format(raisedByFundraiser.get(f.id) ?? 0)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-500">
                    {f.goalAmount ? aud.format(Number(f.goalAmount)) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <a href={`${base}/fundraisers/${f.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-600">
                        <ExternalLink className="h-4 w-4" /> View
                      </a>
                      <Link href={`/admin/fundraisers/${f.id}/edit`} className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-600">
                        <Pencil className="h-4 w-4" /> Edit
                      </Link>
                    </div>
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
