import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Building2, ChevronRight, Plus } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { activeProgram, orgsAvailableToEnrol, slhOrgsForViewer } from '@/lib/slh'
import {
  AllocationForm,
  ApproveButton,
  RemoveButton,
  StartProgramButton,
} from '@/components/slh/OrgApproval'
import { DeliveryDetails } from '@/components/slh/DeliveryDetails'
import { ProgramSettings } from '@/components/slh/ProgramSettings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Referring organisations', robots: { index: false } }

/** A `@db.Date` back to what a date input wants, read in UTC. */
function isoDay(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ''
}

/**
 * Everything Lighthouse sets, on one page.
 *
 * The program year, who may refer children, how many each may nominate, and
 * where and when their gifts are taken. These were spread over two screens and
 * the program's own settings had no screen at all, which meant setting up an
 * organisation involved knowing which page held which half.
 *
 * Each organisation folds open. A list of twelve with every field showing is
 * unreadable; a list of twelve names where one is open is the thing somebody
 * is actually working on.
 */
export default async function AdminSlhOrganisationsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const program = await activeProgram()
  const [enrolled, available, partners] = program
    ? await Promise.all([
        slhOrgsForViewer(),
        orgsAvailableToEnrol(),
        prisma.giftProgramPartner.findMany({
          where: { programId: program.id },
          select: {
            organisationId: true,
            dropOffAddress: true,
            dropOffOpensAt: true,
            dropOffClosesAt: true,
            dropOffDays: true,
          },
        }),
      ])
    : [[], [], []]

  const settingsFor = new Map(partners.map((p) => [p.organisationId, p]))

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/slh"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Santa&rsquo;s Little Helpers
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Referring organisations</h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        Who may nominate children this year, how many each may nominate, and where their gifts are
        taken. Having an account does not make an organisation a referrer — approving it here does.
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
          <ProgramSettings
            name={program.name}
            year={program.year}
            nominationsCloseAt={isoDay(program.nominationsCloseAt)}
          />

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
            <div className="mt-3 grid gap-3">
              {enrolled.map((org) => {
                const settings = settingsFor.get(org.id)
                return (
                  <details
                    key={org.id}
                    className="overflow-hidden rounded-[28px] border border-neutral-200"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-neutral-50">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100 text-sm font-extrabold text-neutral-500">
                        {org.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={org.logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
                        ) : (
                          org.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{org.name}</span>
                        <span className="block text-[13px] text-neutral-400">
                          {org.allocation > 0
                            ? `May nominate ${org.allocation}`
                            : 'Allocation not set'}
                          {settings?.dropOffAddress ? ' · drop-off set' : ' · no drop-off yet'}
                        </span>
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-neutral-300"
                        aria-hidden="true"
                      />
                    </summary>

                    <div className="border-t border-neutral-100 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <AllocationForm organisationId={org.id} allocation={org.allocation} />
                        <RemoveButton organisationId={org.id} name={org.name} />
                      </div>

                      {/* The same panel the organisation edits, so Lighthouse
                          can fill it in for a partner who has not got to it —
                          a drop-off nobody set is an organisation that shows
                          as "not open for shoppers". */}
                      <DeliveryDetails
                        organisationId={org.id}
                        address={settings?.dropOffAddress ?? ''}
                        opensAt={isoDay(settings?.dropOffOpensAt ?? null)}
                        closesAt={isoDay(settings?.dropOffClosesAt ?? null)}
                        days={settings?.dropOffDays ?? []}
                      />

                      <div className="mt-4 flex flex-wrap gap-4 text-[13px] font-semibold">
                        <Link
                          href={`/dashboard/slh/org/${org.id}`}
                          className="underline underline-offset-2 hover:text-[#c8102e]"
                        >
                          Open their program area
                        </Link>
                        <Link
                          href={`/admin/slh/wishlists?org=${org.id}`}
                          className="underline underline-offset-2 hover:text-[#c8102e]"
                        >
                          Their wish lists
                        </Link>
                        <Link
                          href={`/admin/slh/shoppers?org=${org.id}`}
                          className="underline underline-offset-2 hover:text-[#c8102e]"
                        >
                          Their shoppers
                        </Link>
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
          )}

          <h2 className="mt-10 text-lg font-bold tracking-tight">Add a referring organisation</h2>
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
                      <img src={org.logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
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

      <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        New organisations are created at /admin/partners, then approved here.
      </p>
    </div>
  )
}
