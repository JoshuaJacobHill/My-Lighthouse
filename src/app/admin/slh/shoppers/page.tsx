import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { shopperRows, slhScopeOrgs } from '@/lib/slh'
import { SHOPPER_STATUS, shopperStatus, type ShopperStatus } from '@/lib/slh-admin'
import { ListFilters } from '@/components/slh/ListFilters'
import { ShopperSummary } from '@/components/slh/ShopperTable'
import { ShopperBulk } from '@/components/slh/ShopperBulk'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Shoppers', robots: { index: false } }

/**
 * Every shopper across the program, and the waiting list among them.
 *
 * The waiting list is this page filtered, not a page of its own: who is
 * waiting only means anything next to who is being served, and a separate
 * screen is one somebody has to remember to open.
 */
export default async function AdminShoppersPage({
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

  const organisationId = one('org')
  const status = one('status')

  const [orgs, all] = await Promise.all([
    slhScopeOrgs(),
    shopperRows({ organisationId }),
  ])

  // Status is derived from counts rather than stored, so it is filtered here
  // rather than in the query — there is no column to compare.
  const rows = status ? all.filter((r) => shopperStatus(r) === status) : all

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/slh"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Santa&rsquo;s Little Helpers
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Shoppers</h1>
      <ShopperSummary rows={rows} />

      <ListFilters
        menus={[
          {
            name: 'org',
            label: 'All organisations',
            options: orgs.map((o) => ({ value: o.id, label: o.name })),
          },
          {
            name: 'status',
            label: 'Any status',
            options: (Object.keys(SHOPPER_STATUS) as ShopperStatus[]).map((key) => ({
              value: key,
              label: SHOPPER_STATUS[key].label,
            })),
          },
        ]}
      />

      <ShopperBulk rows={rows} showOrganisation />
    </div>
  )
}
