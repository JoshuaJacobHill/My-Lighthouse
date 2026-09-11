'use client'

import * as React from 'react'
import type { TopPost } from '@/lib/business-reports'
import { PostRow } from './PostRow'

/**
 * Top paid ads, sorted by whatever you are actually asking.
 *
 * Spend was the only order before, and it is a reasonable default — it is
 * what you chose to put behind the ad. But it answers "where did the money
 * go", not "what did it do". Which measure matters depends on the ad's
 * purpose, and that is the reader's call rather than the code's.
 *
 * Return is the one to treat carefully, so it is labelled and explained
 * rather than presented as a bare number. See the note below the list.
 */

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

type SortKey = 'spend' | 'views' | 'clicks' | 'purchases' | 'roas'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'spend', label: 'Spend' },
  { value: 'views', label: 'Views' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'roas', label: 'Return' },
]

/** Value returned per dollar spent. Null when there is nothing to divide. */
function roas(p: TopPost): number | null {
  if (p.spendCents <= 0 || p.conversionValueCents <= 0) return null
  return p.conversionValueCents / p.spendCents
}

export function TopPaid({ posts }: { posts: TopPost[] }) {
  const [sort, setSort] = React.useState<SortKey>('spend')

  const sorted = React.useMemo(() => {
    const copy = [...posts]
    switch (sort) {
      case 'views':
        return copy.sort((a, b) => b.views - a.views)
      case 'clicks':
        return copy.sort((a, b) => b.clicks - a.clicks)
      case 'purchases':
        return copy.sort((a, b) => b.conversions - a.conversions || b.spendCents - a.spendCents)
      case 'roas':
        // Ads with no attributed value sink rather than tying at zero: a blank
        // is "not measured", which is different from "returned nothing".
        return copy.sort((a, b) => (roas(b) ?? -1) - (roas(a) ?? -1))
      default:
        return copy.sort((a, b) => b.spendCents - a.spendCents)
    }
  }, [posts, sort])

  const anyValue = posts.some((p) => p.conversionValueCents > 0)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Sort by
        </span>
        {SORTS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setSort(o.value)}
            className={
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors ' +
              (o.value === sort
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
            }
            aria-pressed={o.value === sort}
          >
            {o.label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
        {sorted.map((p) => (
          <li key={p.id}>
            <ul>
              <PostRow post={p} />
            </ul>
            {(p.conversions > 0 || p.conversionValueCents > 0) && (
              <p className="flex flex-wrap gap-x-3 px-4 pb-3 text-xs text-neutral-500">
                <span className="font-semibold text-neutral-700">
                  {p.conversions} purchase{p.conversions === 1 ? '' : 's'}
                </span>
                {p.conversionValueCents > 0 && <span>{money(p.conversionValueCents)} value</span>}
                {roas(p) !== null && (
                  <span className="font-semibold text-neutral-700">
                    {roas(p)!.toFixed(2)}× return
                  </span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>

      {!anyValue && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          No purchase value attributed yet, so Purchases and Return are empty. Meta only credits an
          ad once it can connect a sale to it — for counter trade that means the POS bridge sending
          in-store purchases, which has just started. Expect this to fill in over the coming weeks
          rather than today.
        </p>
      )}
    </div>
  )
}
