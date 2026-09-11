'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { disconnectTikTokAction } from '@/lib/actions/feeds.actions'

/**
 * Detach the connected TikTok account.
 *
 * Confirms first: it is one click away from the Refresh button, and the cost
 * of an accidental press is re-authorising in a browser, which is the one
 * step here that cannot be done from this page.
 */
export function DisconnectButton() {
  const [pending, startTransition] = React.useTransition()
  const [confirming, setConfirming] = React.useState(false)
  const [message, setMessage] = React.useState('')

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-xs text-neutral-600">Disconnect this account?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await disconnectTikTokAction()
                setMessage(res.message)
                setConfirming(false)
              })
            }
            className="inline-flex items-center gap-1 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Yes, disconnect
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-800"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMessage('')
            setConfirming(true)
          }}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          Disconnect
        </button>
      )}
      {message && <span className="text-xs text-neutral-600">{message}</span>}
    </span>
  )
}
