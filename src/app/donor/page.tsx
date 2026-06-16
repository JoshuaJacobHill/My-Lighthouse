import { Heart, Gift, CalendarHeart, Receipt } from 'lucide-react'
import { isDonorPortalEnabled } from '@/lib/features'

export const dynamic = 'force-dynamic'

/**
 * Donor portal home — scaffold only.
 *
 * This is the shell of the donor-facing dashboard. Real data (giving history,
 * totals, receipts, sponsorships) is wired up in later increments. See
 * docs/donor-portal-plan.md.
 */
export default function DonorHomePage() {
  const live = isDonorPortalEnabled()

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {!live && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Preview mode.</strong> The donor portal is hidden from
          volunteers and the public while it&rsquo;s being built. You can see it
          because you&rsquo;re an admin or on the early-access list.
        </div>
      )}

      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">My Giving</h1>
        <p className="mt-2 text-lg text-gray-500">
          Thank you for standing with families doing it tough across South East
          Queensland.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PlaceholderCard
          icon={<Heart className="h-6 w-6" />}
          title="Giving history"
          description="Every gift you've made, in one place."
        />
        <PlaceholderCard
          icon={<Receipt className="h-6 w-6" />}
          title="Tax receipts"
          description="Download your annual giving statements."
        />
        <PlaceholderCard
          icon={<Gift className="h-6 w-6" />}
          title="Recurring giving"
          description="Manage your monthly support and sponsorships."
        />
        <PlaceholderCard
          icon={<CalendarHeart className="h-6 w-6" />}
          title="Appeals & events"
          description="Discover current appeals and upcoming events."
        />
      </div>
    </div>
  )
}

function PlaceholderCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-gray-500">{description}</p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-300">
        Coming soon
      </p>
    </div>
  )
}
