import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canReadFamilies, household } from '@/lib/households'
import { findDuplicatesAction } from '@/lib/actions/households.actions'
import { HouseholdForm } from '@/components/families/HouseholdForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit family', robots: { index: false } }

export default async function EditFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await params
  if (!session) redirect(`/login?next=/admin/families/${id}/edit`)
  if (!(await canReadFamilies())) notFound()

  const home = await household(id)
  if (!home) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/admin/families/${home.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {home.name}
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Edit</h1>

      <HouseholdForm
        findDuplicates={findDuplicatesAction}
        household={{
          id: home.id,
          name: home.name,
          address: home.address,
          suburb: home.suburb,
          postcode: home.postcode,
          phone: home.phone,
          email: home.email,
          standingNotes: home.standingNotes,
          status: home.status,
          consented: home.consentAt !== null,
        }}
      />
    </div>
  )
}
