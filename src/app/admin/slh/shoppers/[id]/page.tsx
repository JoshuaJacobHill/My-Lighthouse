import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { shopperDetail } from '@/lib/slh'
import { SHOPPER_STATUS, shopperStatus, shortfall } from '@/lib/slh-admin'
import { describeRequest } from '@/lib/slh-onboarding'
import { WISH_STEPS, ageOn, doneCount, nextStep } from '@/lib/slh-steps'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { StepTrack } from '@/components/slh/StepTrack'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Shopper', robots: { index: false } }

/**
 * One shopper: who they are, what they asked for, and every list they hold.
 *
 * The page somebody opens when a shopper rings. Their progress per child, and
 * the next step named, because "where are you up to" is the question and
 * "3 of 6" is not an answer to it.
 */
export default async function ShopperPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const { id } = await params
  const shopper = await shopperDetail(id)
  if (!shopper) notFound()

  const held = shopper.children.length
  const delivered = shopper.children.filter((c) => c.deliveredAt).length
  const status = shopperStatus({ requested: shopper.requested, held, delivered })
  const owed = shortfall({ requested: shopper.requested, held })

  const steps = {
    done: shopper.children.reduce((n, c) => n + doneCount(c), 0),
    total: held * WISH_STEPS.length,
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/slh/shoppers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Shoppers
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {shopper.user.name ?? shopper.user.email}
        </h1>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-600">
          {SHOPPER_STATUS[status].label}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-neutral-500">
        {shopper.user.name ? `${shopper.user.email} · ` : ''}
        {shopper.organisation.name}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Asked for', value: describeRequest(shopper) },
          { label: 'Holding', value: `${held} ${held === 1 ? 'list' : 'lists'}` },
          {
            label: owed > 0 ? 'Still waiting on' : 'Delivered',
            value: owed > 0 ? `${owed}` : `${delivered} of ${held}`,
            urgent: owed > 0,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[28px] bg-neutral-50 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-neutral-400">
              {stat.label}
            </p>
            <p
              className={`mt-1 text-sm font-bold ${stat.urgent ? 'text-[#c8102e]' : 'text-neutral-900'}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {held > 0 && (
        <div className="mt-6">
          <StepTrack done={steps.done} total={steps.total} />
          <p className="mt-1.5 text-[13px] text-neutral-500">
            <span className="font-bold tabular-nums text-neutral-700">
              {steps.done}/{steps.total}
            </span>{' '}
            steps across every list they hold
          </p>
        </div>
      )}

      <h2 className="mt-8 text-lg font-bold tracking-tight">
        Their wish lists <span className="font-normal text-neutral-400">{held}</span>
      </h2>

      {held === 0 ? (
        <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          {owed > 0
            ? `Waiting on ${owed} ${owed === 1 ? 'list' : 'lists'}. Hand them out from the shoppers list.`
            : 'Not shopping this year.'}
        </p>
      ) : (
        <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
          {shopper.children.map((child) => {
            const next = nextStep(child)
            const done = doneCount(child)
            return (
              <Link
                key={child.id}
                href={`/dashboard/slh/org/${shopper.organisationId}/child/${child.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-neutral-50"
              >
                <ChildAvatar
                  gender={child.gender === 'girl' ? 'girl' : 'boy'}
                  className="h-12 w-12 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{child.firstName}</span>
                  <span className="block text-[13px] text-neutral-400">
                    {child.gender === 'girl' ? 'Girl' : 'Boy'} {ageOn(child.dateOfBirth)}
                  </span>
                  <span className="mt-2 block max-w-xs">
                    <StepTrack done={done} total={WISH_STEPS.length} />
                  </span>
                  <span className="mt-1.5 block text-xs text-neutral-500">
                    <span className="font-bold tabular-nums text-neutral-700">
                      {done}/{WISH_STEPS.length}
                    </span>
                    {next ? ` · Next: ${next.title}` : ' · Delivered'}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
