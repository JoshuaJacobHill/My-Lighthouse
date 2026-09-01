'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { logFitnessAction } from '@/lib/actions/fitness.actions'

const nf = new Intl.NumberFormat('en-AU')

/** Confirm a reading that arrived through the Android share sheet. */
export function ConfirmShared({
  challengeId,
  steps,
  day,
  assumed,
}: {
  challengeId: string
  steps: number
  day: string
  assumed: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  const dayLabel = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${day}T00:00:00Z`))

  function save() {
    setError('')
    startTransition(async () => {
      const res = await logFitnessAction({ challengeId, day, amount: String(steps) })
      if (!res.success) return setError(res.error ?? 'Could not save that.')
      setSaved(true)
      router.refresh()
    })
  }

  if (saved) {
    return (
      <div className="rounded-[28px] bg-green-50 p-6 text-center">
        <Check className="mx-auto h-8 w-8 text-green-600" aria-hidden="true" />
        <p className="mt-3 text-lg font-bold text-green-900">Saved</p>
        <p className="mt-1 text-sm text-green-800">
          {nf.format(steps)} steps for {dayLabel}.
        </p>
        <Link
          href="/dashboard/fitness"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white hover:bg-neutral-800"
        >
          Back to the challenge
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-[28px] border border-neutral-200 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">We read</p>
      <p className="mt-1 text-4xl font-extrabold tabular-nums text-neutral-950">{nf.format(steps)}</p>
      <p className="mt-1 text-sm text-neutral-600">
        steps for {dayLabel}
        {assumed ? '. No date on the screenshot, so we have assumed today.' : '.'}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {pending ? 'Saving' : 'Looks right, save it'}
        </button>
        <Link
          href="/dashboard/fitness"
          className="inline-flex items-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <p className="mt-4 text-xs text-neutral-400">The screenshot itself was not kept.</p>
    </div>
  )
}
