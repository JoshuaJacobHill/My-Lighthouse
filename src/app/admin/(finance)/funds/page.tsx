import Link from 'next/link'
import { Plus } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { FundsList, type FundRow } from '@/components/admin/FundsList'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Funds | Lighthouse Care Admin' }

function donateBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
}

export default async function FundsPage() {
  const funds = await prisma.fund.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  // Total raised per fund — completed donations only roll up here.
  const sums = await prisma.donation.groupBy({
    by: ['fundId'],
    _sum: { amount: true },
  })
  const raisedByFund = new Map<string, number>()
  for (const s of sums) {
    if (s.fundId) raisedByFund.set(s.fundId, Number(s._sum.amount ?? 0))
  }

  const base = donateBaseUrl()
  const rows: FundRow[] = funds.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    description: f.description,
    isActive: f.isActive,
    showPublicProgress: f.showPublicProgress,
    goalAmount: f.goalAmount ? Number(f.goalAmount) : null,
    raised: raisedByFund.get(f.id) ?? 0,
    donateUrl: `${base}/donate?fund=${f.slug}`,
    embedSnippet: `<iframe src="${base}/embed/donate/${f.slug}" style="width:100%;max-width:480px;height:280px;border:0" title="${f.name} — donate" loading="lazy"></iframe>`,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funds</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Designations for incoming gifts. Each fund has its own donate link,
            and every donation rolls up to its total.
          </p>
        </div>
        <Link href="/admin/funds/new">
          <Button>
            <Plus className="h-4 w-4" />
            New fund
          </Button>
        </Link>
      </div>

      <FundsList funds={rows} />
    </div>
  )
}
