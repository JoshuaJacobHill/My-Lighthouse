'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { logFitnessAction } from '@/lib/actions/fitness.actions'

export function LogStepsForm({
  challengeId,
  today,
  minDay,
  maxDay,
  existingToday,
}: {
  challengeId: string
  today: string
  minDay: string
  maxDay: string
  existingToday: number | null
}) {
  const router = useRouter()
  const [day, setDay] = React.useState(today)
  const [amount, setAmount] = React.useState(existingToday != null ? String(existingToday) : '')
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const res = await logFitnessAction({ challengeId, day, amount })
      if (!res.success) return setError(res.error ?? 'Could not save that.')
      setSaved(true)
      router.refresh()
    })
  }

  const input =
    'w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-neutral-200 p-6">
      <h2 className="text-lg font-bold tracking-tight">Log your steps</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Pop in your daily total. Re-entering a day just corrects it — nothing double-counts.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-medium text-neutral-600">
          Day
          <input type="date" name="day" value={day} min={minDay} max={maxDay} onChange={(e) => setDay(e.target.value)} className={`mt-1 ${input}`} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Steps
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="e.g. 8500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className={`mt-1 ${input}`}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
        </button>
      </div>
      {saved && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
          <Check className="h-4 w-4" /> Saved — nice work.
        </p>
      )}
      {error && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </form>
  )
}
