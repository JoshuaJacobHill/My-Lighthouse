import { requireDonationsAccess } from '@/lib/permissions'

/**
 * Gate for the fundraising / donations admin area (funds, fundraisers, events,
 * transactions, donors). Admins without donations access are redirected to the
 * dashboard, so volunteer-only managers never see donation amounts or donor PII.
 */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireDonationsAccess()
  return <>{children}</>
}
