'use client'

import * as React from 'react'
import { Medal } from 'lucide-react'
import type { Standing, LeaderWindow } from '@/lib/fitness-data'
import { LIME, GREEN } from '@/lib/fitness-milestones'

const nf = new Intl.NumberFormat('en-AU')

const WINDOWS: { key: LeaderWindow; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const EMPTY: Record<LeaderWindow, string> = {
  today: 'Nobody has logged steps today yet.',
  week: 'Nothing logged this week yet.',
  month: 'Nobody has logged any steps yet.',
}

/**
 * Top five, over the day, the week or the month.
 *
 * All three are computed server side in the same pass, so switching between
 * them costs nothing. Today is the default: over a month the same few names
 * settle at the top of the monthly board and it stops being a race, whereas
 * today's is winnable by anyone who goes for a walk this afternoon.
 */
export function TopFive({ top }: { top: Record<LeaderWindow, Standing[]> }) {
  const [window, setWindow] = React.useState<LeaderWindow>('today')
  const rows = top[window]
  const max = Math.max(1, ...rows.map((r) => r.total))

  return (
    <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-bold tracking-tight text-neutral-950">Top 5</h2>
        <div className="flex rounded-full bg-neutral-100 p-0.5" role="tablist" aria-label="Leaderboard range">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              role="tab"
              aria-selected={window === w.key}
              onClick={() => setWindow(w.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                window === w.key
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">{EMPTY[window]}</p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {rows.map((row, i) => (
            <li key={row.userId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={`w-5 shrink-0 text-sm font-bold tabular-nums ${
                      i === 0 ? 'text-orange-600' : 'text-neutral-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate font-semibold text-neutral-900">{row.name}</span>
                  {i === 0 && <Medal className="h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">
                  {nf.format(row.total)}
                </span>
              </div>
              <div className="ml-7 mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(2, Math.round((row.total / max) * 100))}%`,
                    backgroundColor: i === 0 ? GREEN : '#fb923c',
                  }}
                />
              </div>
              {window !== 'today' && (
                <p className="ml-7 mt-1 text-xs text-neutral-400">
                  {row.days} {row.days === 1 ? 'day' : 'days'} logged
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
