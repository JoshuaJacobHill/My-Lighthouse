import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FundForm } from '@/components/admin/FundForm'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'New fund | Lighthouse Care Admin' }

export default async function NewFundPage() {
  await requireCapability('care.giving')
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
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New fund</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          A fund is a designation — where a gift goes. Each fund gets its own
          donate link you can share or embed.
        </p>
      </div>

      <FundForm />
    </div>
  )
}
