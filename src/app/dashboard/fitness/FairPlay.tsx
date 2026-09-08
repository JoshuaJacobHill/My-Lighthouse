'use client'

import * as React from 'react'
import { Info, X, Loader2 } from 'lucide-react'
import { acknowledgeFairPlayAction } from '@/lib/actions/fairplay.actions'

const STORE_KEY = 'lh.fairplay.general.dismissed'

/**
 * The general reminder, for everyone.
 *
 * Quiet and dismissible. Its job is to make the expectation explicit — most
 * fudging in a step challenge is opportunistic, and saying out loud that
 * people are paying attention deters more of it than any threshold, without
 * accusing anyone who simply had a big day.
 *
 * Dismissal is remembered in localStorage rather than the database: it is a
 * per-device convenience, not a fact worth storing about a person.
 */
export function FairPlayNote() {
  // Read once as the initial state rather than in an effect: localStorage is
  // synchronous, so there is nothing to wait for, and doing it here avoids
  // both a wasted render and a dismissed note flashing up before it goes.
  // Returns null on the server, where there is no localStorage — the note then
  // appears on hydration rather than being wrongly hidden.
  const [hidden, setHidden] = React.useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(STORE_KEY) === '1'
    } catch {
      return false
    }
  })

  function dismiss() {
    setHidden(true)
    try {
      window.localStorage.setItem(STORE_KEY, '1')
    } catch {
      // Private browsing, or storage blocked. It reappears next visit, which
      // is a fair trade for not crashing.
    }
  }

  // Nothing until we know, so it cannot flash.
  if (hidden !== false) return null

  return (
    <div className="relative rounded-[28px] border border-neutral-200 bg-neutral-50/60 p-5 pr-12">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/60 hover:text-neutral-700"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <h3 className="flex items-center gap-2 font-bold tracking-tight">
        <Info className="h-4 w-4 text-orange-600" aria-hidden="true" />
        Are you tracking your steps authentically?
      </h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-neutral-600">
        <p>
          Watches and fitness trackers are absolutely welcome in the challenge, but please only
          use them as intended.
        </p>
        <p>
          All steps should be genuinely earned through walking. Please don’t shake your wrist,
          move your device repeatedly, or use any other method to artificially increase your step
          count.
        </p>
        <p>We want to keep the challenge fun, fair and accurate for everyone.</p>
        <p className="font-semibold text-neutral-700">
          Thanks for keeping it honest and enjoying the challenge!
        </p>
      </div>
    </div>
  )
}

/**
 * The personal notice, shown only to someone an admin has sent it to.
 *
 * Not dismissible in the ordinary sense — it takes an acknowledgement, which
 * is recorded. If this is worth sending at all it is worth knowing it was
 * read, and a quiet X would let it be swiped away unread.
 */
export function FairPlayNotice({
  heading,
  paragraphs,
}: {
  heading: string
  paragraphs: readonly string[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [done, setDone] = React.useState(false)

  if (done) return null

  return (
    <div className="rounded-[28px] border-2 border-orange-300 bg-orange-50 p-5">
      <h3 className="font-bold tracking-tight text-orange-900">{heading}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-orange-900/80">
        {paragraphs.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acknowledgeFairPlayAction()
            if (res.success) setDone(true)
          })
        }
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        I’ve read this
      </button>
    </div>
  )
}
