import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { FundForm, type FundFormValues } from '@/components/admin/FundForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Edit fund | Lighthouse Care Admin' }

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : ''
}

export default async function EditFundPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const fund = await prisma.fund.findUnique({ where: { id } })
  if (!fund) notFound()

  const values: FundFormValues = {
    id: fund.id,
    name: fund.name,
    slug: fund.slug,
    description: fund.description ?? '',
    goalAmount: fund.goalAmount ? fund.goalAmount.toString() : '',
    startsAt: toDateInput(fund.startsAt),
    endsAt: toDateInput(fund.endsAt),
    sortOrder: String(fund.sortOrder),
    isActive: fund.isActive,
    showPublicProgress: fund.showPublicProgress,
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/funds"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to funds
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit fund</h1>
        <p className="text-sm text-gray-500 mt-0.5">{fund.name}</p>
      </div>

      <FundForm fund={values} />
    </div>
  )
}
