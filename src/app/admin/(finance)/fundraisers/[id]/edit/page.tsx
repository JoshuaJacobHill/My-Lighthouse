import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { FundraiserForm, type FundraiserFormValues } from '@/components/admin/FundraiserForm'
import { OfflineDonationsManager, type OfflineDonationRow } from '@/components/admin/OfflineDonationsManager'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Edit fundraiser | Lighthouse Care Admin' }

export default async function EditFundraiserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [fundraiser, funds, offline] = await Promise.all([
    prisma.fundraiser.findUnique({ where: { id } }),
    prisma.fund.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.donation.findMany({
      where: { fundraiserId: id, source: 'OFFLINE' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, donorName: true, message: true, amount: true, createdAt: true },
    }),
  ])
  if (!fundraiser) notFound()

  const values: FundraiserFormValues = {
    id: fundraiser.id,
    title: fundraiser.title,
    slug: fundraiser.slug,
    story: fundraiser.story,
    imageUrl: fundraiser.imageUrl ?? '',
    goalAmount: fundraiser.goalAmount ? fundraiser.goalAmount.toString() : '',
    organiserName: fundraiser.organiserName,
    organiserEmail: fundraiser.organiserEmail ?? '',
    fundId: fundraiser.fundId,
    isActive: fundraiser.isActive,
  }

  const offlineRows: OfflineDonationRow[] = offline.map((d) => ({
    id: d.id,
    donorName: d.donorName,
    message: d.message,
    amount: Number(d.amount),
    date: formatDate(d.createdAt),
    donatedAt: new Date(d.createdAt.getTime() + 10 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }))

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/fundraisers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" /> Back to fundraisers
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit fundraiser</h1>
        <p className="text-sm text-gray-500 mt-0.5">{fundraiser.title}</p>
      </div>

      <FundraiserForm fundraiser={values} funds={funds} />
      <OfflineDonationsManager fundraiserId={fundraiser.id} donations={offlineRows} />
    </div>
  )
}
