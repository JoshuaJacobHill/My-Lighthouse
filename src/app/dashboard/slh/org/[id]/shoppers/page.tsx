import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canOpenSlhOrg, shopperRows, slhOrg } from '@/lib/slh'
import { SHOPPER_STATUS, shopperStatus, type ShopperStatus } from '@/lib/slh-admin'
import { ListFilters } from '@/components/slh/ListFilters'
import { ShopperSummary, ShopperTable } from '@/components/slh/ShopperTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Shoppers', robots: { index: false } }

/**
 * The shoppers who chose this organisation.
 *
 * Worth an organisation seeing: these are the people who will arrive at their
 * door in December, and how many of them are still waiting on a list is a
 * prompt to nominate more children.
 */
export default async function OrgShoppersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  if (!(await canOpenSlhOrg(id))) notFound()

  const org = await slhOrg(id)
  if (!org) notFound()

  const query = await searchParams
  const statusRaw = query.status
  const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw

  const all = await shopperRows({ organisationId: id })
  const rows = status ? all.filter((r) => shopperStatus(r) === status) : all

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href={`/dashboard/slh/org/${org.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {org.name}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Shoppers</h1>
        <ShopperSummary rows={rows} />

        <ListFilters
          menus={[
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

        <ShopperTable rows={rows} showOrganisation={false} />
      </div>
    </div>
  )
}
