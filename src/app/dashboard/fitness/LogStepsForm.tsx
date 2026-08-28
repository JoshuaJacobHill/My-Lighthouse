'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, AlertCircle, ImageUp, RotateCcw } from 'lucide-react'
import { logFitnessAction, readStepsScreenshotAction } from '@/lib/actions/fitness.actions'

/**
 * Logging steps from a screenshot.
 *
 * There is deliberately no field to type a number into. Everyone's total sits
 * on a shared leaderboard, and a free text box invites rounding up. So the
 * number has to come from a screenshot of the phone's own health app, or from
 * the shortcut posting it directly.
 *
 * Worth being honest about the limits: this raises the bar rather than closing
 * the door. A screenshot can be edited.
 */
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
  screenshotEnabled?: boolean
}) {
  const router = useRouter()
  const fileRef = React.useRef<HTMLInputElement>(null)

  const [reading, setReading] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const [unavailable, setUnavailable] = React.useState(false)
  /** What the screenshot gave us, waiting to be confirmed. */
  const [found, setFound] = React.useState<{ steps: number; day: string; assumed: boolean } | null>(null)

  const nf = new Intl.NumberFormat('en-AU')
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(`${d}T00:00:00Z`)
    )

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')
    setSaved(false)
    setFound(null)
    setReading(true)

    const body = new FormData()
    body.append('screenshot', file)
    readStepsScreenshotAction(body)
      .then((res) => {
        if (!res.success) {
          if (res.unavailable) setUnavailable(true)
          return setError(res.error ?? 'Could not read that screenshot.')
        }
        if (res.steps == null || !res.day) return setError('Could not find a step total in that one.')
        setFound({ steps: res.steps, day: res.day, assumed: Boolean(res.dateAssumed) })
      })
      .catch(() => setError('Could not read that screenshot.'))
      .finally(() => setReading(false))
  }

  function save() {
    if (!found) return
    setError('')
    startTransition(async () => {
      const res = await logFitnessAction({ challengeId, day: found.day, amount: String(found.steps) })
      if (!res.success) return setError(res.error ?? 'Could not save that.')
      setSaved(true)
      setFound(null)
      router.refresh()
    })
  }

  if (!screenshotEnabled || unavailable) {
    return (
      <section className="rounded-[28px] border border-dashed border-neutral-300 p-6">
        <h2 className="text-lg font-bold tracking-tight">Logging your steps</h2>
        <p className="mt-1.5 text-sm text-neutral-500">
          Set up the shortcut and your phone sends your steps on its own. Screenshot uploads are unavailable at the
          moment.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-neutral-200 p-6">
      <h2 className="text-lg font-bold tracking-tight">Log your steps</h2>
      <p className="mt-1.5 text-sm text-neutral-500">
        {existingToday != null
          ? `You have ${nf.format(existingToday)} logged today. Upload a newer screenshot to update it.`
          : 'Upload a screenshot of your health app and we will read the total off it.'}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFile}
      />

      {found ? (
        <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">We read</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-neutral-950">{nf.format(found.steps)}</p>
          <p className="mt-0.5 text-sm text-neutral-600">
            steps for {dayLabel(found.day)}
            {found.assumed ? '. No date on the screenshot, so we have assumed today.' : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              {pending ? 'Saving' : 'Looks right, save it'}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try another
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={reading}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {reading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading it
            </>
          ) : (
            <>
              <ImageUp className="h-4 w-4" aria-hidden="true" /> Upload screenshot
            </>
          )}
        </button>
      )}

      {saved && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
          <Check className="h-4 w-4" aria-hidden="true" /> Saved. Nice work.
        </p>
      )}
      {error && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        We read the number and the date, then throw the picture away. It is never saved.
      </p>
    </section>
  )
}
