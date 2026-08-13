import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ORG } from '@/lib/org'
import { formatDate } from '@/lib/utils'
import { PrintButton } from './PrintButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Donation receipt — Lighthouse Care' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const gift = await prisma.donation.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      amount: true,
      donorName: true,
      donorEmail: true,
      createdAt: true,
      taxReceiptEligible: true,
      fund: { select: { name: true } },
    },
  })

  // Donor-only: must own this gift.
  if (!gift || gift.userId !== session.userId) notFound()

  const receiptNo = `LC-${gift.id.slice(-8).toUpperCase()}`

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to my giving
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{ORG.name}</h1>
            <p className="mt-1 text-sm text-gray-500">ABN {ORG.abn}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {ORG.isDGR ? 'Tax-Deductible Receipt' : 'Donation Receipt'}
            </p>
            <p className="mt-1 text-sm text-gray-500">No. {receiptNo}</p>
          </div>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <Row label="Received from" value={gift.donorName || gift.donorEmail} />
          <Row label="Date of gift" value={formatDate(gift.createdAt)} />
          <Row label="Fund" value={gift.fund?.name ?? 'General'} />
          <div className="flex items-baseline justify-between border-t border-gray-200 pt-4">
            <dt className="font-semibold text-gray-900">Amount</dt>
            <dd className="text-2xl font-bold text-gray-900">{aud.format(Number(gift.amount))}</dd>
          </div>
        </dl>

        <p className="mt-8 text-sm leading-relaxed text-gray-500">
          {ORG.isDGR
            ? 'This gift is a tax-deductible donation. No goods or services were provided in return. Please retain this receipt for your records.'
            : 'Thank you for your generous gift. Please retain this receipt for your records.'}
        </p>
        <p className="mt-6 text-sm text-gray-600">
          With heartfelt thanks — from all of us at {ORG.name}.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}
