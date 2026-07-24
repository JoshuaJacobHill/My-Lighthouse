import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { FundraiserForm } from '@/components/admin/FundraiserForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'New fundraiser | Lighthouse Care Admin' }

export default async function NewFundraiserPage() {
  const funds = await prisma.fund.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/fundraisers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" /> Back to fundraisers
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New fundraiser</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          A public page with its own goal, story and donor list. Proceeds are allocated to a fund.
        </p>
      </div>

      {funds.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          You need at least one active fund first. <Link href="/admin/funds/new" className="font-medium underline">Create a fund</Link>, then come back.
        </div>
      ) : (
        <FundraiserForm funds={funds} />
      )}
    </div>
  )
}
