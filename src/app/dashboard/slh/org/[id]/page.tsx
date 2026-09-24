import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ChevronRight, Users } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import {
  activeProgram,
  canOpenSlhOrg,
  enrolment,
  orgFamilies,
  orgLooseChildren,
  orgNominatedCount,
  slhOrg,
} from '@/lib/slh'
import { FamilyList, type FamilyRow } from '@/components/slh/FamilyList'
import { DeliveryDetails } from '@/components/slh/DeliveryDetails'
import { ageOn } from '@/lib/slh-steps'

/**
 * A `@db.Date` back to the `YYYY-MM-DD` a date input wants.
 *
 * Read in UTC, because that is how Prisma stores a date-only column — reading
 * it in Brisbane would hand back the previous day.
 */
function isoDay(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ''
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Santa’s Little Helpers', robots: { index: false } }

/**
 * A referring organisation's program area.
 *
 * The organisation is real — name, logo, members, and the same per-row
 * `canAdminOrg` rule the partner pages use — and so is its **enrolment**: the
 * approval to refer, the allocation Lighthouse set, and the drop-off window.
 * Reaching this page at all means an enrolment exists; `canOpenSlhOrg` checks
 * that before it checks who is asking.
 *
 * The families and children are real too, counted rather than estimated: the
 * allocation bar reads the nominations actually recorded against this
 * organisation, so it cannot drift from what the list below shows.
 */
export default async function SlhOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  if (!(await canOpenSlhOrg(id))) notFound()

  const [org, program, enrolled] = await Promise.all([slhOrg(id), activeProgram(), enrolment(id)])
  // `canOpenSlhOrg` already required both; this narrows the types.
  if (!org || !program || !enrolled) notFound()

  const [rows, loose, nominated] = await Promise.all([
    orgFamilies(org.id),
    orgLooseChildren(org.id),
    orgNominatedCount(org.id),
  ])

  const families: FamilyRow[] = rows.map((f) => ({
    id: f.id,
    guardian: f.guardianName,
    email: f.guardianEmail ?? '',
    phone: f.guardianPhone ?? '',
    children: f.children.map((c) => ({
      id: c.id,
      name: c.firstName,
      age: ageOn(c.dateOfBirth),
      // "Complete" here means the wish list has been filled in, not shopped
      // for — it is what the organisation chases a family about.
      complete: Boolean(c.wishWant && c.wishNeed && c.wishWear && c.wishRead),
    })),
  }))

  const allocation = enrolled.allocation
  const remaining = Math.max(0, allocation - nominated)
  // An allocation of 0 means "approved, ceiling not set yet" — not "none left".
  const pct = allocation > 0 ? Math.round((nominated / allocation) * 100) : 0
  const closes = program.nominationsCloseAt
    ? formatDate(program.nominationsCloseAt, 'd MMMM')
    : null

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/slh/org"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Organisations
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-neutral-100 text-base font-extrabold text-neutral-500">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              org.name.slice(0, 2).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#c8102e]">
              {program.name}
            </p>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">{org.name}</h1>
          </div>
        </div>

        {/* The ceiling Lighthouse sets. Nothing here may go past it. */}
        <div className="mt-6 rounded-[28px] bg-neutral-50 p-5">
          <div className="flex items-baseline justify-between">
            <b className="text-sm">Your allocation</b>
            <span className="text-[13px] tabular-nums text-neutral-500">
              {allocation > 0 ? `${nominated} of ${allocation}` : 'Not set yet'}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-[#c8102e]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-sm text-neutral-500">
            {allocation === 0 ? (
              <>
                You&rsquo;re approved to refer children this year. Lighthouse will confirm how many
                you can nominate.
              </>
            ) : (
              <>
                You can nominate <b className="text-neutral-900">{remaining}</b> more{' '}
                {remaining === 1 ? 'child' : 'children'}
                {closes ? (
                  <>
                    {' '}
                    until nominations close on <b className="text-neutral-900">{closes}</b>
                  </>
                ) : null}
                .
              </>
            )}
          </p>
        </div>

        <Link
          href={`/dashboard/slh/org/${org.id}/family`}
          className="mt-4 block rounded-full bg-[#c8102e] py-3.5 text-center text-base font-bold text-white hover:bg-[#9d0b23]"
        >
          Add a family
        </Link>

        <div className="mt-8">
          <FamilyList families={families} organisationId={org.id} />
        </div>

        {loose.length > 0 && (
          <>
            <h2 className="mt-8 text-lg font-bold tracking-tight">Your team is filling these in</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Nominated without a parent or guardian to send the wish list to.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {loose.map((child) => (
                <Link
                  key={child.id}
                  href={`/dashboard/slh/org/${org.id}/child/${child.id}`}
                  className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-[13px] font-semibold transition-colors hover:border-neutral-900"
                >
                  {child.firstName}{' '}
                  <span className="font-normal text-neutral-400">{ageOn(child.dateOfBirth)}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Only exists for an enrolled organisation — a corporate partner has
            no drop-off, which is why this lives on the program link and not on
            the partner profile. */}
        <DeliveryDetails
          organisationId={org.id}
          address={enrolled.dropOffAddress ?? ''}
          opensAt={isoDay(enrolled.dropOffOpensAt)}
          closesAt={isoDay(enrolled.dropOffClosesAt)}
          days={enrolled.dropOffDays}
        />

        <div className="mt-8 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
          <Link
            href={`/partners/${org.slug}`}
            className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-neutral-50"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Our profile</span>
              <span className="block text-[13px] text-neutral-400">
                The partner page people already see
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-8 rounded-[28px] border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-500">
          Santa&rsquo;s Little Helpers is still being set up, so only super admins and this
          organisation&rsquo;s own admins can see this page. The reminder emails are not connected
          yet — everything else here saves.
        </p>
      </div>
    </div>
  )
}
