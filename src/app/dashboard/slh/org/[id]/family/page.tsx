import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canOpenSlhOrg, slhOrg } from '@/lib/slh'
import { AddFamilyForm } from '@/components/slh/AddFamilyForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add a family', robots: { index: false } }

/**
 * Nominating a family.
 *
 * Guarded by `canOpenSlhOrg`, which means this organisation's own admins — the
 * one screen in the program a referrer uses rather than Lighthouse. The form
 * and its rules live in `AddFamilyForm`; this page is the frame around it.
 */
export default async function AddFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  if (!(await canOpenSlhOrg(id))) notFound()
  const org = await slhOrg(id)
  if (!org) notFound()

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href={`/dashboard/slh/org/${org.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {org.name}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Add a family</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          The guardian&rsquo;s details stay with you and Lighthouse. A shopper never sees them.
        </p>

        <AddFamilyForm organisationId={org.id} />

        <div className="mt-8 rounded-[28px] bg-neutral-50 p-5">
          <b className="text-sm">Would the family rather fill it in themselves?</b>
          <p className="mt-1.5 text-sm text-neutral-500">
            One link for the whole family — a few questions per child, on a phone, and it comes
            back here. No account, no password. Not built yet.
          </p>
        </div>
      </div>
    </div>
  )
}
