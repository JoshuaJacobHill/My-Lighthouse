'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Run the shortcut from the page.
 *
 * Shortcuts registers the `shortcuts://` scheme, so a link can run one by name.
 * The x-callback form sends the person back here afterwards, which turns "open
 * the portal, see stale numbers" into "open the portal, see today's numbers".
 *
 * It matches on the shortcut's name, so this only works if they kept the one we
 * gave them. If nothing happens, they either renamed it or have not installed
 * it, which is what the help text says.
 */
export function SyncNowButton({ shortcutName = 'Send my steps' }: { shortcutName?: string }) {
  const [tapped, setTapped] = React.useState(false)

  function run() {
    setTapped(true)
    const back = typeof window !== 'undefined' ? window.location.href : ''
    const url =
      `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(shortcutName)}` +
      (back ? `&x-success=${encodeURIComponent(back)}&x-error=${encodeURIComponent(back)}` : '')
    window.location.href = url
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={run}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Update my steps now
      </button>
      {tapped && (
        <p className="mt-2 text-center text-xs text-neutral-500">
          If nothing happened, the shortcut is not installed on this phone, or it has a different name.
        </p>
      )}
    </div>
  )
}
