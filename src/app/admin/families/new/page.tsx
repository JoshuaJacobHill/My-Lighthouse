import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canReadFamilies } from '@/lib/households'
import { findDuplicatesAction } from '@/lib/actions/households.actions'
import { HouseholdForm } from '@/components/families/HouseholdForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add a family', robots: { index: false } }

export default async function NewFamilyPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/admin/families/new')
  if (!(await canReadFamilies())) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/families"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Families
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Add a family</h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        Enough to find them again and to know who is in the household. The people and what
        they&rsquo;ve received come next, on their record.
      </p>

      <HouseholdForm findDuplicates={findDuplicatesAction} />
    </div>
  )
}
