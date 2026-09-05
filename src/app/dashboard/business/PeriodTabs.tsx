'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import * as React from 'react'
import type { Period } from '@/lib/business-reports'

const OPTIONS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
]

/**
 * The period lives in the URL rather than component state, so a manager can
 * bookmark "this month" and send someone a link to what they are looking at.
 */
export function PeriodTabs({ active }: { active: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  function pick(next: Period) {
    const q = new URLSearchParams(params.toString())
    q.set('period', next)
    startTransition(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }))
  }

  return (
    <div className="inline-flex rounded-full border border-neutral-200 p-0.5" role="tablist">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={active === o.key}
          disabled={pending}
          onClick={() => pick(o.key)}
          className={
            'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ' +
            (active === o.key
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-500 hover:text-neutral-800')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
