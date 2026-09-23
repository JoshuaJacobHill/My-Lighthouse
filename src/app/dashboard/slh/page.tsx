import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { SantaMark } from '@/components/slh/SantaMark'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { StepTrack } from '@/components/slh/StepTrack'
import { SAMPLE_CHILDREN, SAMPLE_ORG, WISH_STEPS, daysUntil } from '@/lib/slh-sample'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Santa’s Little Helpers', robots: { index: false } }

/**
 * A shopper's wish lists.
 *
 * Reached from a card on the dashboard rather than the nav: most people here
 * never shop for a child, and Santa's Little Helpers is one thing a supporter
 * does rather than a place they live.
 *
 * **Sample data.** Nothing on this page is real yet — see `slh-sample.ts`.
 * Super admins only until it is.
 */
export default async function SlhPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const days = daysUntil(SAMPLE_ORG.closes)

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
              SANTA’S
            </p>
            <p className="text-[11px] font-bold tracking-[0.22em] text-neutral-900">
              LITTLE HELPERS
            </p>
          </div>
        </div>

        <p className="mt-5 text-base font-extrabold tracking-tight">
          {days > 0
            ? `Your gifts need to be delivered in ${days} days`
            : days === 0
              ? 'Your gifts need to be delivered today'
              : 'Drop-off has closed'}
        </p>
        <p className="mt-1.5 text-sm text-neutral-500">
          {SAMPLE_ORG.name} · {SAMPLE_ORG.window}
        </p>

        <h1 className="mt-7 text-3xl font-extrabold tracking-tight">Your wish lists</h1>

        <div className="mt-3 divide-y divide-neutral-100">
          {SAMPLE_CHILDREN.map((child) => {
            const next = WISH_STEPS.find((s) => !child.done.includes(s.key))
            return (
              <Link
                key={child.id}
                href={`/dashboard/slh/${child.id}`}
                className="flex items-center gap-4 py-4 transition-colors hover:bg-neutral-50"
              >
                <ChildAvatar gender={child.gender} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-extrabold leading-tight tracking-tight">
                    {child.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {child.gender === 'girl' ? 'Girl' : 'Boy'} age {child.age} · {child.id}
                  </p>
                  <StepTrack done={child.done.length} total={WISH_STEPS.length} className="mt-2.5" />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    <span className="font-bold tabular-nums text-neutral-700">
                      {child.done.length}/{WISH_STEPS.length}
                    </span>
                    {next ? ` · Next: ${next.title}` : ' · Delivered — thank you'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
              </Link>
            )
          })}
        </div>

        <p className="mt-10 rounded-[28px] border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-500">
          Preview with sample children. Nothing here is real, and only super admins can see it.
        </p>
      </div>
    </div>
  )
}
