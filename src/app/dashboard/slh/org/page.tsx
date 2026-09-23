import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Building2, ChevronRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { activeProgram, orgsAvailableToEnrol, slhOrgsForViewer } from '@/lib/slh'
import {
  AllocationForm,
  ApproveButton,
  RemoveButton,
  StartProgramButton,
} from '@/components/slh/OrgApproval'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Referring organisations', robots: { index: false } }

/**
 * Who may refer children to this year's program.
 *
 * The list is **approvals, not organisations**. Having an account here does not
 * make an organisation a referrer — Good Food is a corporate partner and would
 * have no business nominating children — so an organisation appears above only
 * once somebody at Lighthouse has picked it from the list below. Picking it is
 * the approval; there is no separate flag to forget to set.
 */
export default async function SlhOrgPickerPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Approving a referrer is Lighthouse's call, so this page is Lighthouse's.
  // An organisation admin reaches their own area directly, not through here.
  if (!canPreviewSlh(session.user)) notFound()

  const program = await activeProgram()
  const [enrolled, available] = program
    ? await Promise.all([slhOrgsForViewer(), orgsAvailableToEnrol()])
    : [[], []]

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
          The organisations approved to nominate children this year, and how many each may
          nominate. Built on the partner organisations that already exist — a referring agency is
          an organisation with members who sign in, not a new kind of account.
        </p>

        {!program ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 font-semibold">No program is running</p>
            <p className="mt-1 text-sm text-neutral-500">
              Organisations are approved against a program year. Start one to begin.
            </p>
            <StartProgramButton year={new Date().getFullYear()} />
          </div>
        ) : (
          <>
            <h2 className="mt-8 text-lg font-bold tracking-tight">
              Approved{' '}
              <span className="font-normal text-neutral-400">
                {enrolled.length} {enrolled.length === 1 ? 'organisation' : 'organisations'}
              </span>
            </h2>

            {enrolled.length === 0 ? (
              <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                Nobody is approved yet. Add one from the list below.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
                {enrolled.map((org) => (
                  <div key={org.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100 text-sm font-extrabold text-neutral-500">
                        {org.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={org.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          org.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <Link
                        href={`/dashboard/slh/org/${org.id}`}
                        className="group min-w-0 flex-1"
                      >
                        <span className="block font-bold group-hover:underline">{org.name}</span>
                        <span className="block text-[13px] text-neutral-400">
                          {org.members} {org.members === 1 ? 'member' : 'members'}
                          {org.mine ? ' · you administer this' : ''}
                        </span>
                      </Link>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-neutral-300"
                        aria-hidden="true"
                      />
                    </div>

                    {/* The ceiling Lighthouse sets. 0 reads as "approved, not yet set". */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-14">
                      <AllocationForm organisationId={org.id} allocation={org.allocation} />
                      <RemoveButton organisationId={org.id} name={org.name} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mt-10 text-lg font-bold tracking-tight">
              Add a referring organisation
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Every organisation with an account. Adding one approves it to nominate children for{' '}
              {program.name}.
            </p>

            {available.length === 0 ? (
              <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                Every organisation with an account is already approved. New ones are created at{' '}
                <Link href="/admin/partners" className="font-semibold underline">
                  /admin/partners
                </Link>
                .
              </p>
            ) : (
              <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
                {available.map((org) => (
                  <div key={org.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100 text-[11px] font-extrabold text-neutral-500">
                      {org.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        org.name.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{org.name}</span>
                      <span className="block text-[12px] text-neutral-400">
                        {org.members} {org.members === 1 ? 'member' : 'members'}
                      </span>
                    </span>
                    <ApproveButton organisationId={org.id} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="mt-10 rounded-[28px] border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-500">
          The organisations and their approvals are real and save. The families, children and
          drop-off window inside each one are still sample data.
        </p>
      </div>
    </div>
  )
}
