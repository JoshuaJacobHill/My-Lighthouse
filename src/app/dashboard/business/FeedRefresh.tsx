'use client'

import * as React from 'react'
import { Loader2, RotateCw } from 'lucide-react'
import { refreshFeedAction, type FeedName } from '@/lib/actions/feeds.actions'

/**
 * Pull one feed now.
 *
 * Sits beside the feed's own row, because "when did this last run" and "run it
 * again" are the same thought. One feed per press: a serverless function has
 * about a minute, and three ingests in series would not reliably fit.
 */
export function FeedRefresh({ feed, label }: { feed: FeedName; label: string }) {
  const [pending, startTransition] = React.useTransition()
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null)

  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult(null)
          startTransition(async () => {
            const res = await refreshFeedAction(feed)
            setResult({ ok: res.success, message: res.message })
          })
        }}
        className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCw className="h-3 w-3" aria-hidden="true" />
        )}
        <span className="sr-only">Refresh {label}</span>
        Refresh
      </button>
      {result && (
        <span className={result.ok ? 'text-xs text-lime-700' : 'text-xs text-red-700'}>
          {result.message}
        </span>
      )}
    </span>
  )
}
