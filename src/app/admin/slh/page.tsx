import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Building2, ChevronRight, Gift, Users } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { activeProgram, shopperRows, wishListRows, slhScopeOrgs } from '@/lib/slh'
import { listStatus, shopperStatus, shortfall } from '@/lib/slh-admin'
import { DEFAULT_BANNED_TERMS } from '@/lib/wishlist-limits'
import { extraBannedTerms } from '@/lib/wishlist-limits.server'
import { BannedTerms } from '@/components/slh/BannedTerms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Santa’s Little Helpers', robots: { index: false } }

/**
 * Lighthouse's own view of the program.
 *
 * Deliberately in `/admin` rather than under the supporter dashboard: running
 * Santa's Little Helpers is administration, and it belongs beside partners and
 * events. The supporter side stays at `/dashboard/slh`, which is where a
 * shopper lives.
 */
export default async function AdminSlhPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const program = await activeProgram()
  const [orgs, shoppers, lists, extraBanned] = await Promise.all([
    slhScopeOrgs(),
    shopperRows({}),
    wishListRows({}),
    extraBannedTerms(),
  ])

  const waiting = shoppers.filter((s) => shopperStatus(s) === 'waiting')
  const owed = waiting.reduce((n, s) => n + shortfall(s), 0)
  const unfilled = lists.filter((l) => listStatus(l) === 'unfilled').length
  const unassigned = lists.filter((l) => listStatus(l) === 'ready').length

  const cards = [
    {
      href: '/admin/slh/organisations',
      icon: Building2,
      title: 'Referring organisations',
      line: `${orgs.length} approved`,
      note: 'Approve organisations, set allocations and drop-off windows',
    },
    {
      href: '/admin/slh/shoppers',
      icon: Users,
      title: 'Shoppers',
      line: `${shoppers.length} signed up`,
      note:
        waiting.length > 0
          ? `${waiting.length} waiting on ${owed} ${owed === 1 ? 'list' : 'lists'}`
          : 'Nobody waiting',
      urgent: waiting.length > 0,
    },
    {
      href: '/admin/slh/wishlists',
      icon: Gift,
      title: 'Wish lists',
      line: `${lists.length} ${lists.length === 1 ? 'child' : 'children'}`,
      note:
        unfilled > 0
          ? `${unfilled} not filled in · ${unassigned} ready to hand out`
          : `${unassigned} ready to hand out`,
      urgent: unfilled > 0,
    },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#c8102e]">
        {program?.name ?? 'Santa’s Little Helpers'}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Santa&rsquo;s Little Helpers</h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        {program
          ? 'Children nominated by local organisations, and the supporters shopping for them.'
          : 'No program is running yet — start one from Referring organisations.'}
      </p>

      <div className="mt-6 grid gap-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-center gap-4 rounded-[28px] border border-neutral-200 px-5 py-4 transition-colors hover:bg-neutral-50"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">
              <card.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{card.title}</span>
              <span className="block text-[13px] text-neutral-500">
                {card.line} ·{' '}
                <span className={card.urgent ? 'font-semibold text-[#c8102e]' : ''}>
                  {card.note}
                </span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
          </Link>
        ))}
      </div>

      <BannedTerms extra={extraBanned} builtInCount={DEFAULT_BANNED_TERMS.length} />
    </div>
  )
}
