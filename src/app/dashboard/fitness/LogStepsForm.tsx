'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, AlertCircle, ImageUp } from 'lucide-react'
import { logFitnessAction, readStepsScreenshotAction } from '@/lib/actions/fitness.actions'

export function LogStepsForm({
  challengeId,
  today,
  minDay,
  maxDay,
  existingToday,
  screenshotEnabled = false,
}: {
  challengeId: string
  today: string
  minDay: string
  maxDay: string
  existingToday: number | null
  /** Hidden entirely when screenshot reading isn't configured. */
  screenshotEnabled?: boolean
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

  // ── Reading a screenshot ──
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [reading, setReading] = React.useState(false)
  const [readNote, setReadNote] = React.useState('')

  function onScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear straight away so choosing the same file twice still fires.
    e.target.value = ''
    if (!file) return

    setError('')
    setSaved(false)
    setReadNote('')
    setReading(true)

    const body = new FormData()
    body.append('screenshot', file)
    readStepsScreenshotAction(body)
      .then((res) => {
        if (!res.success) return setError(res.error ?? 'Could not read that screenshot.')
        if (res.steps != null) setAmount(String(res.steps))
        if (res.day) setDay(res.day)
        setReadNote(
          res.dateAssumed
            ? `Read ${res.steps?.toLocaleString('en-AU')} steps. No date on the screenshot, so we’ve put today — change it if that’s wrong, then save.`
            : `Read ${res.steps?.toLocaleString('en-AU')} steps. Check it matches your screen, then save.`
        )
      })
      .catch(() => setError('Could not read that screenshot.'))
      .finally(() => setReading(false))
  }

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

      {screenshotEnabled && (
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onScreenshot}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={reading || pending}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {reading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading your screenshot…
              </>
            ) : (
              <>
                <ImageUp className="h-4 w-4" aria-hidden="true" /> Read it from a screenshot
              </>
            )}
          </button>
          {readNote && (
            <p className="mt-2.5 inline-flex items-start gap-1.5 text-sm text-neutral-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" /> {readNote}
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-400">
            Handy on Android, where there&rsquo;s no automatic option. We read the number and the date off it and
            throw the picture away &mdash; it&rsquo;s never saved anywhere.
          </p>
        </div>
      )}
    </form>
  )
}
