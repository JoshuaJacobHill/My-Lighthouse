'use client'

import * as React from 'react'
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Confetti } from '@/components/fitness/Confetti'
import { LIME, GREEN } from '@/lib/fitness-milestones'
import type { ChallengeWeek } from '@/lib/fitness-weeks'

const nf = new Intl.NumberFormat('en-AU')

/**
 * Week-by-week winners, swipeable.
 *
 * A native scroll container with snap points rather than a JS carousel: it
 * gets touch, momentum, keyboard and screen-reader behaviour for free, and it
 * degrades to a plain scrolling row if anything about the script fails.
 *
 * Only completed weeks name a winner. A week in progress shows who is ahead,
 * labelled as such — telling someone they have won on the Thursday and then
 * taking it back on the Friday would be worse than not saying.
 */
export function WeekWinners({ weeks }: { weeks: ChallengeWeek[] }) {
  const scroller = React.useRef<HTMLDivElement>(null)

  // Open on the most interesting week: the one just finished if there is one,
  // otherwise the one we are in.
  const focusIndex = React.useMemo(() => {
    const lastComplete = [...weeks].reverse().find((w) => w.complete)
    const current = weeks.find((w) => w.current)
    const target = lastComplete ?? current ?? weeks[0]
    return Math.max(0, weeks.findIndex((w) => w.number === target?.number))
  }, [weeks])

  // Scroll to it once, on mount, without smooth behaviour so it does not
  // visibly slide on load.
  const done = React.useRef(false)
  React.useEffect(() => {
    if (done.current || !scroller.current) return
    done.current = true
    const card = scroller.current.children[focusIndex] as HTMLElement | undefined
    if (!card) return
    // Measured from the elements themselves rather than offsetLeft, which is
    // relative to whichever ancestor happens to be positioned.
    const cardBox = card.getBoundingClientRect()
    const boxBox = scroller.current.getBoundingClientRect()
    scroller.current.scrollLeft += cardBox.left - boxBox.left
  }, [focusIndex])

  function nudge(direction: -1 | 1) {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: direction * (el.clientWidth * 0.85), behavior: 'smooth' })
  }

  if (weeks.length === 0) return null

  return (
    <section className="min-w-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Week by week</h2>
        <div className="flex gap-1">
          {([-1, 1] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => nudge(d)}
              aria-label={d === -1 ? 'Previous weeks' : 'Next weeks'}
              className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
            >
              {d === -1 ? (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scroller}
        className="relative mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {weeks.map((w) => (
          <WeekCard key={w.number} week={w} />
        ))}
      </div>
    </section>
  )
}

function WeekCard({ week }: { week: ChallengeWeek }) {
  const leader = week.winner ?? week.standings[0] ?? null
  const isWinner = week.complete && week.winner !== null
  const future = !week.complete && !week.current

  return (
    <div
      className={clsx(
        'relative w-[86%] shrink-0 snap-center overflow-hidden rounded-[28px] border p-5 sm:w-[62%] lg:w-[46%]',
        isWinner ? 'border-transparent' : 'border-neutral-200',
      )}
      style={isWinner ? { backgroundColor: GREEN } : undefined}
    >
      {/* Only on a settled result, and only once — the burst plays on mount. */}
      {isWinner && <Confetti />}

      <div className="relative">
        <div className="flex items-baseline justify-between">
          <p
            className={clsx(
              'text-xs font-bold uppercase tracking-wide',
              isWinner ? 'text-white/70' : 'text-neutral-400',
            )}
          >
            Week {week.number}
            {week.current && ' · in progress'}
          </p>
          <p className={clsx('text-xs', isWinner ? 'text-white/70' : 'text-neutral-400')}>
            {week.label}
          </p>
        </div>

        {future || !leader ? (
          <p className="mt-6 text-sm text-neutral-400">
            {future ? 'Still to come.' : 'No steps logged yet.'}
          </p>
        ) : (
          <>
            {isWinner ? (
              <p
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-neutral-950"
                style={{ backgroundColor: LIME }}
              >
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                Week {week.number} winner!
              </p>
            ) : (
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-orange-600">
                Leading so far
              </p>
            )}

            <p
              className={clsx(
                'mt-2 text-2xl font-extrabold tracking-tight',
                isWinner ? 'text-white' : 'text-neutral-950',
              )}
            >
              {leader.name}
            </p>
            <p className={clsx('text-sm font-semibold', isWinner ? 'text-white/80' : 'text-neutral-500')}>
              {nf.format(leader.steps)} steps
            </p>

            {week.standings.length > 1 && (
              <ul className={clsx('mt-4 space-y-1 border-t pt-3', isWinner ? 'border-white/20' : 'border-neutral-100')}>
                {week.standings.slice(1, 4).map((s, i) => (
                  <li
                    key={s.userId}
                    className={clsx(
                      'flex items-baseline justify-between text-sm',
                      isWinner ? 'text-white/80' : 'text-neutral-600',
                    )}
                  >
                    <span>
                      {i + 2}. {s.name}
                    </span>
                    <span>{nf.format(s.steps)}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className={clsx('mt-3 text-xs', isWinner ? 'text-white/60' : 'text-neutral-400')}>
              {nf.format(week.total)} steps between everyone
            </p>
          </>
        )}
      </div>
    </div>
  )
}
