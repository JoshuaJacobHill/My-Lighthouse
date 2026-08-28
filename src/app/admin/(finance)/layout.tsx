import { requireAnyCapability } from '@/lib/permissions'

/**
 * Coarse gate for the fundraising area. It only asks "do you have any business
 * being in here at all" — every page inside carries its own precise capability
 * guard, because this group is no longer one audience: funds, fundraisers,
 * events, donors and migrations are Care giving, transactions are split between
 * Care giving and church tithes, and good news stories are written by both
 * sides. Widening this layout without those per-page guards would hand a church
 * manager the Care donor list.
 */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability(['care.giving', 'church.giving', 'care.stories', 'church.stories'])
  return <>{children}</>
}
