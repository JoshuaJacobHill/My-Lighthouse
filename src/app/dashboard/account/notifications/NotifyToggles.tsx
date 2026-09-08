'use client'

import * as React from 'react'
import { setNotifyPreferenceAction } from '@/lib/actions/preferences.actions'

type Key = 'notifyEmail' | 'notifyComments' | 'notifyMentions' | 'notifyStories'

/**
 * A switch that shows what it did.
 *
 * Optimistic, and reverts if the save fails — a toggle that appears to work
 * and silently didn't is worse than one that hesitates.
 */
function Toggle({
  label,
  hint,
  field,
  initial,
}: {
  label: string
  hint?: string
  field: Key
  initial: boolean
}) {
  const [on, setOn] = React.useState(initial)
  const [pending, startTransition] = React.useTransition()

  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-neutral-900">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={pending}
        onClick={() => {
          const next = !on
          setOn(next)
          startTransition(async () => {
            const res = await setNotifyPreferenceAction(field, next)
            if (!res.success) setOn(!next)
          })
        }}
        className={
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ' +
          (on ? 'bg-orange-600' : 'bg-neutral-300')
        }
      >
        <span
          className={
            'absolute top-1 h-5 w-5 rounded-full bg-white transition-all ' +
            (on ? 'left-6' : 'left-1')
          }
        />
      </button>
    </div>
  )
}

export function NotifyToggles({
  prefs,
}: {
  prefs: { notifyEmail: boolean; notifyComments: boolean; notifyMentions: boolean; notifyStories: boolean }
}) {
  return (
    <div className="divide-y divide-neutral-100">
      <Toggle
        label="Email"
        hint="Receipts and anything needing action still come through."
        field="notifyEmail"
        initial={prefs.notifyEmail}
      />
      <Toggle
        label="Comments"
        hint="Replies on a story or task you're part of."
        field="notifyComments"
        initial={prefs.notifyComments}
      />
      <Toggle
        label="Mentions"
        hint="When someone tags you by name."
        field="notifyMentions"
        initial={prefs.notifyMentions}
      />
      <Toggle
        label="Good news stories"
        hint="When a new story goes up."
        field="notifyStories"
        initial={prefs.notifyStories}
      />
    </div>
  )
}
