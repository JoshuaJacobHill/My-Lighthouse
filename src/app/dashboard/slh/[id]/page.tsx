import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { childById, SAMPLE_ORG, WISH_KINDS, WISH_STEPS } from '@/lib/slh-sample'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Wish list', robots: { index: false } }

/**
 * One child's wish list, and the chain of steps for it.
 *
 * Interests and the child's own words come before the four gifts on purpose:
 * they are what turns a list of items into a person to shop for. The story only
 * appears once somebody at Lighthouse has approved it.
 *
 * **Sample data.** Super admins only — see `slh-sample.ts`.
 */
export default async function WishListPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPreviewSlh(session.user)) notFound()

  const { id } = await params
  const child = childById(id)
  if (!child) notFound()

  const firstOpen = WISH_STEPS.findIndex((s) => !child.done.includes(s.key))

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/slh"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Your wish lists
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <ChildAvatar gender={child.gender} className="h-20 w-20 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight">{child.name}</h1>
            <p className="text-sm text-neutral-500">
              {child.gender === 'girl' ? 'Girl' : 'Boy'} age {child.age} · {child.colour} is their
              favourite
            </p>
            <p className="text-sm tabular-nums text-neutral-400">{child.id}</p>
          </div>
        </div>

        {child.interests.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {child.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-[13px] font-semibold"
              >
                {interest}
              </span>
            ))}
          </div>
        )}

        {child.story.approved && child.story.text && (
          <figure className="mt-5 rounded-[28px] bg-neutral-50 px-5 py-4">
            <blockquote className="text-[15px] italic leading-relaxed">
              “{child.story.text}”
            </blockquote>
            <figcaption className="mt-2.5 text-xs text-neutral-400">
              {child.name}, in their own words
            </figcaption>
          </figure>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-xl bg-neutral-50 px-3 py-1.5 text-[13px] text-neutral-500">
            Clothes <b className="font-bold text-neutral-900">{child.clothes}</b>
          </span>
          <span className="rounded-xl bg-neutral-50 px-3 py-1.5 text-[13px] text-neutral-500">
            Shoes <b className="font-bold text-neutral-900">{child.shoes}</b>
          </span>
        </div>

        <div className="mt-6 divide-y divide-neutral-100 border-t border-neutral-100">
          {WISH_KINDS.map(([key, label]) => (
            <div key={key} className="py-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#c8102e]">
                {label}
              </p>
              <p className="mt-1 text-[17px] font-medium leading-snug">{child[key]}</p>
            </div>
          ))}
        </div>

        <p className="rounded-[28px] bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-600">
          Around <b className="font-bold text-neutral-900">$200</b> across the four gifts. Please
          leave price tags off, and keep everything for {child.name} in one bag.
        </p>

        <h2 className="mt-8 text-lg font-bold tracking-tight">Your steps</h2>
        <ol className="mt-2 divide-y divide-neutral-100">
          {WISH_STEPS.map((step, i) => {
            const done = child.done.includes(step.key)
            const now = i === firstOpen
            return (
              <li key={step.key} className="flex items-start gap-4 py-3.5">
                <span
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                    done
                      ? 'border-green-600 bg-green-600 text-white'
                      : now
                        ? 'border-[#c8102e] text-transparent'
                        : 'border-neutral-200 text-transparent'
                  }`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[15px] font-bold ${done ? 'text-neutral-500' : ''} ${
                      i > firstOpen && firstOpen !== -1 ? 'text-neutral-400' : ''
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-neutral-400">{step.hint}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <p className="mt-8 text-center text-xs text-neutral-400">
          Nominated by {SAMPLE_ORG.name} · sample data
        </p>
      </div>
    </div>
  )
}
