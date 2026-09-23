import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays, ChevronRight, Users } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canOpenSlhOrg, slhOrg } from '@/lib/slh'
import { FamilyList, type FamilyRow } from '@/components/slh/FamilyList'
import {
  SAMPLE_ALLOCATION,
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
 * `canAdminOrg` rule the partner pages use. Everything inside it is sample data
 * until the program has a schema, because none of it has anywhere to live yet:
 * the allocation, the families, the children, the drop-off window.
 *
 * That split is the point of this page. It shows what the organisation's side
 * looks like bolted onto the framework that already exists, so the schema can
 * be designed against something somebody has actually used.
 */
export default async function SlhOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  if (!(await canOpenSlhOrg(id))) notFound()

  const org = await slhOrg(id)
  if (!org) notFound()

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
  const remaining = SAMPLE_ALLOCATION - SAMPLE_NOMINATED
  const pct = Math.round((SAMPLE_NOMINATED / SAMPLE_ALLOCATION) * 100)

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
              Santa&rsquo;s Little Helpers 2026
            </p>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">{org.name}</h1>
          </div>
        </div>

        {/* The ceiling Lighthouse sets. Nothing here may go past it. */}
        <div className="mt-6 rounded-[28px] bg-neutral-50 p-5">
          <div className="flex items-baseline justify-between">
            <b className="text-sm">Your allocation</b>
            <span className="text-[13px] tabular-nums text-neutral-500">
              {SAMPLE_NOMINATED} of {SAMPLE_ALLOCATION}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-[#c8102e]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-sm text-neutral-500">
            You can nominate <b className="text-neutral-900">{remaining}</b> more{' '}
            {remaining === 1 ? 'child' : 'children'} until nominations close on{' '}
            <b className="text-neutral-900">21 November</b>.
          </p>
        </div>

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
          <b className="text-neutral-700">{org.name} is real.</b> The allocation, families,
          children and drop-off window are sample data — they have nowhere to live until the program
          has a schema. Nothing on this page saves.
        </p>
      </div>
    </div>
  )
}
