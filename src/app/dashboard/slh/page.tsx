import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { SantaMark } from '@/components/slh/SantaMark'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { StepTrack } from '@/components/slh/StepTrack'
import { activeProgram, enrolment, myShopper, myWishLists } from '@/lib/slh'
import { WISH_STEPS, ageOn, daysUntil, doneCount, nextStep } from '@/lib/slh-steps'
import { describeRequest } from '@/lib/slh-onboarding'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Santa’s Little Helpers', robots: { index: false } }

/**
 * A shopper's wish lists.
 *
 * Reached from a card on the dashboard rather than the nav: most people here
 * never shop for a child, and Santa's Little Helpers is one thing a supporter
 * does rather than a place they live.
 *
 * Somebody who has not signed up is sent through onboarding first — there is
 * nothing to show them, and the sign-up is what decides which organisation's
 * children and drop-off window this page is even about.
 */
export default async function SlhPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const program = await activeProgram()
  if (!program) notFound()

  const shopper = await myShopper()
  if (!shopper) redirect('/dashboard/slh/join')

  const [children, partner] = await Promise.all([
    myWishLists(),
    enrolment(shopper.organisationId),
  ])

  const closes = partner?.dropOffClosesAt ?? null
  const days = closes ? daysUntil(closes) : null

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Home
        </Link>

        <div className="mt-4 overflow-hidden rounded-[28px] bg-[#c8102e] p-4">
          <div className="grid justify-items-center gap-2 rounded-[18px] bg-white px-4 py-6">
            <SantaMark className="h-14 w-14" />
            <p className="text-2xl font-extrabold leading-none tracking-tight text-[#c8102e]">
              SANTA&rsquo;S
            </p>
            <p className="text-[11px] font-bold tracking-[0.22em] text-neutral-900">
              LITTLE HELPERS
            </p>
          </div>
        </div>

        {/* The countdown only means something once there is a date to count to. */}
        {days !== null && (
          <p className="mt-5 text-base font-extrabold tracking-tight">
            {days > 1
              ? `Your gifts need to be delivered in ${days} days`
              : days === 1
                ? 'Your gifts need to be delivered tomorrow'
                : days === 0
                  ? 'Your gifts need to be delivered today'
                  : 'Drop-off has closed'}
          </p>
        )}
        <p className="mt-1.5 text-sm text-neutral-500">
          {shopper.organisation.name}
          {partner?.dropOffAddress ? ` · ${partner.dropOffAddress}` : ''}
        </p>

        <h1 className="mt-7 text-3xl font-extrabold tracking-tight">Your wish lists</h1>

        {children.length === 0 ? (
          <div className="mt-4 rounded-[28px] border border-dashed border-neutral-300 p-8 text-center">
            <p className="font-semibold">Your wish lists are on their way</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-neutral-500">
              You asked for {describeRequest(shopper)}. We&rsquo;ll let you know the moment{' '}
              {shopper.requested === 1 ? 'it arrives' : 'they arrive'} — nothing to do until then.
            </p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-neutral-100">
            {children.map((child) => {
              const next = nextStep(child)
              const done = doneCount(child)
              return (
                <Link
                  key={child.id}
                  href={`/dashboard/slh/${child.id}`}
                  className="flex items-center gap-4 py-4 transition-colors hover:bg-neutral-50"
                >
                  <ChildAvatar
                    gender={child.gender === 'girl' ? 'girl' : 'boy'}
                    className="h-16 w-16 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-extrabold leading-tight tracking-tight">
                      {child.firstName}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {child.gender === 'girl' ? 'Girl' : 'Boy'} age {ageOn(child.dateOfBirth)}
                    </p>
                    <StepTrack done={done} total={WISH_STEPS.length} className="mt-2.5" />
                    <p className="mt-1.5 text-xs text-neutral-500">
                      <span className="font-bold tabular-nums text-neutral-700">
                        {done}/{WISH_STEPS.length}
                      </span>
                      {next ? ` · Next: ${next.title}` : ' · Delivered — thank you'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
                </Link>
              )
            })}
          </div>
        )}

        <Link
          href="/dashboard/slh/org"
          className="mt-8 flex items-center gap-3 rounded-[28px] border border-neutral-200 px-5 py-4 transition-colors hover:bg-neutral-50"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Referring organisations</span>
            <span className="block text-[13px] text-neutral-400">
              The other side: families, allocations and reminders
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
