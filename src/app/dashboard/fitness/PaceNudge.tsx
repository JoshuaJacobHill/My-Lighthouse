'use client'

import * as React from 'react'
import { X, Sparkles } from 'lucide-react'
import { LIME } from '@/lib/fitness-milestones'

/**
 * The nudge about doing a few more steps, as something you can dismiss.
 *
 * It sat inside the target card, where there was no way to get rid of it. A
 * message telling you that you are behind is fine once and wearing by the
 * fourth visit, so it closes and stays closed for the day.
 */
export function PaceNudge({ message, positive }: { message: string; positive: boolean }) {
  const key = `lh-pace-nudge-${new Date().toISOString().slice(0, 10)}`
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(key) !== 'dismissed')
    } catch {
      setOpen(true) // storage blocked, show it
    }
  }, [key])

  function close() {
    setOpen(false)
    try {
      window.localStorage.setItem(key, 'dismissed')
    } catch {
      // Nothing to do. It will simply reappear next visit.
    }
  }

  if (!open || !message) return null

  return (
    <div
      className="flex items-start gap-3 rounded-[28px] px-5 py-4"
      style={{ backgroundColor: positive ? LIME : '#fff7ed' }}
      role="status"
    >
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-neutral-900" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium text-neutral-900">{message}</p>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-neutral-900/50 hover:bg-black/10 hover:text-neutral-900"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
