'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Copy, Check, Smartphone, Link2Off } from 'lucide-react'
import { connectFitnessAction, disconnectFitnessAction } from '@/lib/actions/fitness.actions'

interface Props {
  initialToken: string | null
  endpoint: string
  lastUsedAt: string | null
  lastAmount: number | null
}

/** Small copy-to-clipboard field — these values get typed into a phone. */
function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard is blocked in some in-app browsers — the text stays selectable.
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-1 flex items-stretch gap-2">
        <code
          className={`flex-1 overflow-x-auto rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm ${mono ? 'font-mono' : ''} text-neutral-800`}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
        {n}
      </span>
      <div className="pb-6">
        <p className="font-semibold text-neutral-900">{title}</p>
        <div className="mt-1 space-y-2 text-sm text-neutral-600">{children}</div>
      </div>
    </li>
  )
}

export function ConnectHealth({ initialToken, endpoint, lastUsedAt, lastAmount }: Props) {
  const router = useRouter()
  const [token, setToken] = React.useState(initialToken)
  const [error, setError] = React.useState('')
  const [isPending, startTransition] = React.useTransition()

  function connect() {
    setError('')
    startTransition(async () => {
      const res = await connectFitnessAction()
      if (!res.success) return setError(res.error ?? 'Something went wrong. Please try again.')
      setToken(res.token ?? null)
      router.refresh()
    })
  }

  function disconnect() {
    setError('')
    startTransition(async () => {
      const res = await disconnectFitnessAction()
      if (!res.success) return setError(res.error ?? 'Something went wrong. Please try again.')
      setToken(null)
      router.refresh()
    })
  }

  if (!token) {
    return (
      <div className="mt-8">
        <button
          type="button"
          onClick={connect}
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600 disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Setting up&hellip;
            </>
          ) : (
            <>
              <Smartphone className="h-4 w-4" /> Set this up on my phone
            </>
          )}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-center text-xs text-neutral-500">
          Takes about two minutes on an iPhone. Nothing is sent until you finish the setup.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-8">
      {lastUsedAt && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Working &mdash; last received {lastAmount != null ? `${lastAmount.toLocaleString('en-AU')} steps ` : ''}
          {new Date(lastUsedAt).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}.
        </div>
      )}

      <h2 className="text-lg font-bold text-neutral-900">Set it up on your iPhone</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Do this on the phone itself &mdash; you&rsquo;ll be copying these two values into the Shortcuts app.
      </p>

      <ol className="mt-6">
        <Step n={1} title="Open Shortcuts and make a new shortcut">
          <p>
            The Shortcuts app comes with your iPhone. Tap <strong>+</strong> in the top corner to start a new one, and
            name it <strong>Send my steps</strong>.
          </p>
        </Step>

        <Step n={2} title="Add “Find Health Samples”">
          <p>
            Search for <strong>Find Health Samples</strong> and add it. Set <strong>Type</strong> to{' '}
            <strong>Steps</strong>, then add a filter so the date <strong>is today</strong>.
          </p>
          <p>Health will ask for permission the first time you run it — that&rsquo;s the opt-in.</p>
        </Step>

        <Step n={3} title="Add up the day">
          <p>
            Add <strong>Calculate Statistics</strong>, set it to <strong>Sum</strong> of{' '}
            <strong>Health Samples</strong>. That gives you one number: today&rsquo;s total.
          </p>
        </Step>

        <Step n={4} title="Send it across">
          <p>
            Add <strong>Get Contents of URL</strong> and paste the address below. Tap the arrow to expand it, set{' '}
            <strong>Method</strong> to <strong>POST</strong>, then:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Under <strong>Headers</strong>, add key <code className="font-mono">Authorization</code> with the value
              below.
            </li>
            <li>
              Under <strong>Request Body</strong>, choose <strong>JSON</strong>, add a{' '}
              <strong>Number</strong> field called <code className="font-mono">steps</code>, and set its value to the{' '}
              <strong>Statistics</strong> result from step 3.
            </li>
          </ul>
          <CopyField label="Web address" value={endpoint} />
          <CopyField label="Authorization header value" value={`Bearer ${token}`} />
        </Step>

        <Step n={5} title="Make it run by itself through the day">
          <p>
            In the <strong>Automation</strong> tab, tap <strong>+</strong>, choose{' '}
            <strong>Time of Day</strong>, pick a time, and set it to repeat <strong>daily</strong>. Choose{' '}
            <strong>Run Immediately</strong> and turn off <strong>Notify When Run</strong>, then pick your{' '}
            <strong>Send my steps</strong> shortcut.
          </p>
          <p>
            <strong>Set up a few of these at different times</strong> and the leaderboard keeps up with you through
            the day rather than catching up overnight. Four is plenty:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>12&nbsp;pm</strong>, <strong>4&nbsp;pm</strong> and <strong>8&nbsp;pm</strong> — keeps your
              total fresh while everyone&rsquo;s watching
            </li>
            <li>
              <strong>11:30&nbsp;pm</strong> — the one that matters, because it catches the full day
            </li>
          </ul>
          <p className="text-neutral-500">
            Each one sends your running total for the day and replaces the last, so there&rsquo;s no double-counting
            — more of them just means a fresher number. Apple only lets these repeat daily, so genuinely hourly
            would mean sixteen automations; four gets you most of the way.
          </p>
          <p>
            Miss a day? Run the shortcut by hand, or type that day&rsquo;s number in on the challenge page.
          </p>
        </Step>

        <Step n={6} title="Test it">
          <p>
            Tap the play button on the shortcut. Allow Health access when asked, then check the challenge page —
            today&rsquo;s steps should be sitting there.
          </p>
        </Step>
      </ol>

      <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-800">On Android?</p>
        <p className="mt-1">
          Android keeps step data locked to the phone in much the same way, and there&rsquo;s no equivalent of
          Shortcuts built in. On the challenge page you can either type your daily total in, or upload a screenshot
          of your health app and we&rsquo;ll read the number off it &mdash; then throw the picture away.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-neutral-200 pt-6">
        <button
          type="button"
          onClick={disconnect}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          <Link2Off className="h-4 w-4" /> Stop sending my steps
        </button>
        <button
          type="button"
          onClick={connect}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          Start again with a new code
        </button>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Stopping leaves the steps you&rsquo;ve already logged in place — it only stops your phone sending more. A new
        code immediately stops the old one working, so update the shortcut if you generate one.
      </p>
    </div>
  )
}
