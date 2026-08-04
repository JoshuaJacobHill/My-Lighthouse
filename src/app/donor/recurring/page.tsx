import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Repeat, ArrowRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { listMyRecurringGifts } from '@/lib/actions/recurring.actions'
import { CancelRecurringButton } from '@/components/donor/CancelRecurringButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Recurring giving' }

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function RecurringGivingPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const gifts = await listMyRecurringGifts()

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/donor/giving"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my giving
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Recurring giving</h1>
      <p className="mt-1.5 text-gray-500">Manage your ongoing gifts. You can cancel any time.</p>

      {gifts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Repeat className="mx-auto h-8 w-8 text-orange-400" />
          <p className="mt-3 text-gray-600">You don’t have any active recurring gifts.</p>
          <Link
            href="/donate"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Set up a recurring gift <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {gifts.map((g) => (
            <div
              key={g.id}
              className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                  <Repeat className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-gray-900">
                    {aud.format(g.amount)}{' '}
                    <span className="font-normal text-gray-500">· {g.frequencyLabel}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {g.fundName ?? 'Lighthouse Care'}
                    {g.nextChargeAt && ` · next gift ${formatDate(g.nextChargeAt)}`}
                  </p>
                </div>
              </div>
              <CancelRecurringButton id={g.id} account={g.account} label={g.frequencyLabel.toLowerCase()} />
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        To change the amount or frequency, cancel this gift and set up a new one — we&rsquo;ll add
        in-place editing soon.
      </p>
    </div>
  )
}
