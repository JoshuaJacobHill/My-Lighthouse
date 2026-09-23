import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays, ChevronRight, Users } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { activeProgram, canOpenSlhOrg, enrolment, slhOrg } from '@/lib/slh'
import { FamilyList, type FamilyRow } from '@/components/slh/FamilyList'
import {
  SAMPLE_EVENT,
  SAMPLE_FAMILIES,
  SAMPLE_NOMINATED,
  childById,
  listComplete,
  unfamiliedChildren,
} from '@/lib/slh-sample'

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
 * The families and children inside are still sample data, because they have
 * nowhere to live yet. That split is the point of the page: it shows the
 * organisation's side bolted onto the framework that already exists, so the
 * rest of the schema can be designed against something somebody has used.
 */
export default async function SlhOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  if (!(await canOpenSlhOrg(id))) notFound()

  const [org, program, enrolled] = await Promise.all([slhOrg(id), activeProgram(), enrolment(id)])
  // `canOpenSlhOrg` already required both; this narrows the types.
  if (!org || !program || !enrolled) notFound()

  const families: FamilyRow[] = SAMPLE_FAMILIES.map((f) => ({
    id: f.id,
    guardian: f.guardian,
    email: f.email,
    phone: f.phone,
    children: f.childIds.flatMap((childId) => {
      const child = childById(childId)
      return child
        ? [{ id: child.id, name: child.name, age: child.age, complete: listComplete(child) }]
        : []
    }),
  }))

  const loose = unfamiliedChildren()
  const allocation = enrolled.allocation
  // Nominations are still fiction, so this one number stays sample data — but
  // it is capped by the real allocation so the bar can't run past its ceiling.
  const nominated = Math.min(SAMPLE_NOMINATED, allocation)
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

        {enrolled.dropOffAddress && (
          <p className="mt-3 text-sm text-neutral-500">
            Gifts come to <b className="text-neutral-900">{enrolled.dropOffAddress}</b>.
          </p>
        )}

        <Link
          href={`/dashboard/slh/org/${org.id}/family`}
          className="mt-4 block rounded-full bg-[#c8102e] py-3.5 text-center text-base font-bold text-white hover:bg-[#9d0b23]"
        >
          Add a family
        </Link>

        <div className="mt-8">
          <FamilyList families={families} />
        </div>

        {loose.length > 0 && (
          <>
            <h2 className="mt-8 text-lg font-bold tracking-tight">Not linked to a family</h2>
            <p className="mt-1 text-sm text-neutral-500">
              For a child in residential or kinship care, where there is no parent to fill it in.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {loose.map((child) => (
                <span
                  key={child.id}
                  className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-[13px] font-semibold"
                >
                  {child.name} <span className="font-normal text-neutral-400">{child.age}</span>
                </span>
              ))}
            </div>
          </>
        )}

        <div className="mt-8 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Your event</span>
              <span className="block text-[13px] text-neutral-400">
                {SAMPLE_EVENT.on
                  ? `On · ${SAMPLE_EVENT.when.split(',')[0]} · ${SAMPLE_EVENT.rsvps} coming`
                  : 'Off'}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
          </div>
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
          <b className="text-neutral-700">{org.name}, its approval and its allocation are real.</b>{' '}
          The families, children and event below are sample data — they have nowhere to live until
          the rest of the program has a schema, and nothing on this page saves them.
        </p>
      </div>
    </div>
  )
}
