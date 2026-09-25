import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canReadFamilies, households } from '@/lib/households'
import { HOUSEHOLD_STATUSES, daysSince, supportLabel } from '@/lib/households-core'
import { ListFilters } from '@/components/slh/ListFilters'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Families', robots: { index: false } }

/**
 * The households Lighthouse supports.
 *
 * Search is the whole page: somebody has a name, a suburb or half a phone
 * number and needs the right family in one go. Everything else — who they are,
 * what they have had — is a line under the name, because a list that makes you
 * open four records to find one is a list nobody uses.
 */
export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect('/login?next=/admin/families')
  if (!(await canReadFamilies())) notFound()

  const params = await searchParams
  const one = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const rows = await households({ search: one('q'), status: one('status') })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Families</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            The households we&rsquo;re walking alongside, and what they&rsquo;ve received.
          </p>
        </div>
        <Link
          href="/admin/families/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add a family
        </Link>
      </div>

      <ListFilters
        search="Search a name, suburb or phone number"
        menus={[
          {
            name: 'status',
            label: 'Any status',
            options: HOUSEHOLD_STATUSES.map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="mt-6 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold">
            {one('q') ? 'Nobody matches that' : 'No families yet'}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {one('q')
              ? 'Try a surname, a suburb, or the last few digits of a phone number.'
              : 'Add the first one to start keeping a record.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
          {rows.map((row) => {
            const children = row.members.filter((m) => m.relationship === 'CHILD').length
            const since = daysSince(row.lastSupport?.givenAt ?? null)
            return (
              <Link
                key={row.id}
                href={`/admin/families/${row.id}`}
                className="block px-5 py-4 transition-colors hover:bg-neutral-50"
              >
                <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="font-bold">{row.name}</span>
                  {row.suburb && (
                    <span className="text-[13px] text-neutral-500">{row.suburb}</span>
                  )}
                  {row.status !== 'ACTIVE' && (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-500">
                      {HOUSEHOLD_STATUSES.find(([v]) => v === row.status)?.[1]}
                    </span>
                  )}
                </span>

                <span className="mt-0.5 block text-[13px] text-neutral-400">
                  {[
                    `${row.members.length} ${row.members.length === 1 ? 'person' : 'people'}`,
                    children > 0 ? `${children} ${children === 1 ? 'child' : 'children'}` : null,
                    row.phone,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>

                <span className="mt-1 block text-[13px]">
                  {row.lastSupport ? (
                    <>
                      <span className="text-neutral-500">Last: </span>
                      <b className="text-neutral-800">{supportLabel(row.lastSupport.kind)}</b>
                      <span className="text-neutral-500">
                        {since === 0
                          ? ' today'
                          : since === 1
                            ? ' yesterday'
                            : ` ${since} days ago`}
                        {row.supportCount > 1 ? ` · ${row.supportCount} in total` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400">Nothing recorded yet</span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
