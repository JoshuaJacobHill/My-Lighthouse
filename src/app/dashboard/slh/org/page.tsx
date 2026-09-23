import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Building2, ChevronRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { slhOrgsForViewer } from '@/lib/slh'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Referring organisations', robots: { index: false } }

/**
 * Which organisation's program area to open.
 *
 * These are **real** partner organisations, read through the same per-row rule
 * the partner pages use: normally the ones you administer. A super admin
 * previewing sees all of them, which is the only reason this list can be longer
 * than one.
 */
export default async function SlhOrgPickerPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const orgs = await slhOrgsForViewer()

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/slh"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Santa&rsquo;s Little Helpers
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Referring organisations</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Built on the partner organisations that already exist — a referring agency is an
          organisation with members who sign in, not a new kind of account.
        </p>

        {orgs.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 font-semibold">No organisations yet</p>
            <p className="mt-1 text-sm text-neutral-500">
              Partner organisations are created at /admin/partners.
            </p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/dashboard/slh/org/${org.id}`}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-neutral-50"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100 text-sm font-extrabold text-neutral-500">
                  {org.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    org.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{org.name}</span>
                  <span className="block text-[13px] text-neutral-400">
                    {org.members} {org.members === 1 ? 'member' : 'members'}
                    {org.mine ? ' · you administer this' : ''}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}

        <p className="mt-8 rounded-[28px] border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-500">
          The organisations are real. The families, children and allocation inside are sample data
          until the program has a schema.
        </p>
      </div>
    </div>
  )
}
