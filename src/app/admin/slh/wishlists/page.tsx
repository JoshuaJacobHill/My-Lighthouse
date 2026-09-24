import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { wishListRows, slhScopeOrgs } from '@/lib/slh'
import { AGE_FILTERS, LIST_STATUS, listStatus, type ListStatus } from '@/lib/slh-admin'
import { ListFilters } from '@/components/slh/ListFilters'
import { WishListSummary, WishListTable } from '@/components/slh/WishListTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Wish lists', robots: { index: false } }

/**
 * Every wish list in the program.
 *
 * Lighthouse sees the child and the status, which is what running the program
 * needs — not the guardian, who belongs to the organisation that nominated
 * them. The organisation's own version of this list shows that column.
 */
export default async function AdminWishListsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const params = await searchParams
  const one = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const status = one('status')
  const [orgs, all] = await Promise.all([
    slhScopeOrgs(),
    wishListRows({
      organisationId: one('org'),
      gender: one('gender'),
      age: one('age'),
      search: one('q'),
    }),
  ])

  // Status is derived, so it cannot be a `where` clause.
  const rows = status ? all.filter((r) => listStatus(r) === status) : all

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/slh"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Santa&rsquo;s Little Helpers
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Wish lists</h1>
      <WishListSummary rows={rows} />

      <ListFilters
        search="Search a first name"
        menus={[
          {
            name: 'org',
            label: 'All organisations',
            options: orgs.map((o) => ({ value: o.id, label: o.name })),
          },
          {
            name: 'status',
            label: 'Any status',
            options: (Object.keys(LIST_STATUS) as ListStatus[]).map((key) => ({
              value: key,
              label: LIST_STATUS[key].label,
            })),
          },
          {
            name: 'age',
            label: 'Any age',
            options: AGE_FILTERS.map(([value, label]) => ({ value, label })),
          },
          {
            name: 'gender',
            label: 'Girls and boys',
            options: [
              { value: 'girl', label: 'Girls' },
              { value: 'boy', label: 'Boys' },
            ],
          },
        ]}
      />

      <WishListTable
        rows={rows}
        showOrganisation
        showGuardian={false}
        hrefFor={(row) => `/dashboard/slh/org/${row.organisationId}/child/${row.id}`}
      />
    </div>
  )
}
