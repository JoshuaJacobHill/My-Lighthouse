'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Copy, Check, Smartphone, Link2Off, Download } from 'lucide-react'
import { connectFitnessAction, disconnectFitnessAction } from '@/lib/actions/fitness.actions'

interface Props {
  initialToken: string | null
  appUrl: string
  /** iCloud link to the ready made shortcut, if one has been set up. */
  shortcutUrl: string | null
  lastUsedAt: string | null
  lastAmount: number | null
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-neutral-200 p-5">
      <h2 className="text-sm font-bold text-neutral-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-neutral-600">{children}</div>
    </section>
  )
}

/** Numbered list that keeps its spacing right, unlike a bolded "1." inline. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
            {i + 1}
          </span>
          <span className="pt-0.5 text-sm text-neutral-600">{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function ConnectHealth({ initialToken, appUrl, shortcutUrl, lastUsedAt, lastAmount }: Props) {
  const router = useRouter()
  const [token, setToken] = React.useState(initialToken)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState('')
  const [isPending, startTransition] = React.useTransition()

  const personalUrl = `${appUrl}/api/fitness/steps/${encodeURIComponent(token ?? '')}`

  // Nothing arriving is the normal failure here, and it is silent: people
  // install the shortcut, run it once, see it work, and never add the
  // automation that actually keeps it running.
  const status = React.useMemo(() => {
    if (!token) return null
    if (!lastUsedAt) {
      return {
        stale: true,
        headline: 'Nothing has come through yet',
        detail: 'Run the shortcut once to check it works, then add the automation so it keeps going on its own.',
      }
    }
    const hours = (Date.now() - new Date(lastUsedAt).getTime()) / 3_600_000
    const when = new Date(lastUsedAt).toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
    const amount = lastAmount != null ? `${lastAmount.toLocaleString('en-AU')} steps` : 'your steps'
    if (hours > 36) {
      return {
        stale: true,
        headline: 'Your phone has stopped sending',
        detail: `Last received ${amount} on ${when}. Most likely there is no automation set up, so it only runs when you tap it. Step 4 below.`,
      }
    }
    return { stale: false, headline: 'Working', detail: `Last received ${amount} on ${when}.` }
  }, [token, lastUsedAt, lastAmount])

  async function copyCode() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Blocked in some in app browsers. The code is short enough to read.
    }
  }

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

  // ── Not set up yet ──
  if (!token) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={connect}
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600 disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Setting up
            </>
          ) : (
            <>
              <Smartphone className="h-4 w-4" aria-hidden="true" /> Get my code
            </>
          )}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-center text-sm text-neutral-500">
          Takes about two minutes on an iPhone. Nothing sends until you finish.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      {status && (
        <div
          className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
            status.stale ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'
          }`}
        >
          <p className="font-semibold">{status.headline}</p>
          <p className="mt-0.5">{status.detail}</p>
        </div>
      )}

      {/* ── The code, front and centre ── */}
      <div className="rounded-[28px] bg-neutral-950 px-5 py-7 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Your personal code</p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-[0.12em] sm:text-4xl">{token}</p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy code'}
        </button>
        <p className="mx-auto mt-4 max-w-xs text-xs leading-relaxed text-white/50">
          Yours alone. Please don&rsquo;t pass it on.
        </p>
      </div>

      {/* ── The one thing to do ── */}
      {shortcutUrl ? (
        <section className="mt-4 rounded-2xl border border-neutral-200 p-5">
          <h2 className="text-sm font-bold text-neutral-900">Set it up</h2>
          <Steps
            items={[
              <>Copy your code above.</>,
              <>
                Tap the button below, then <strong>Add Shortcut</strong>. Paste your code when it asks.
              </>,
              <>Run it once and allow Health access. That is the opt in.</>,
              <>
                In the <strong>Automation</strong> tab tap <strong>+</strong>, choose <strong>App</strong>, pick
                something you open often, set <strong>Is Opened</strong> and <strong>Run Immediately</strong>.
              </>,
            ]}
          />
          <a
            href={shortcutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Add the shortcut to my phone
          </a>
          <p className="mt-3 text-center text-xs text-neutral-500">
            Opens Shortcuts, which comes with your iPhone.
          </p>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-600">
          <h2 className="text-sm font-bold text-neutral-900">One tap install is not ready yet</h2>
          <p className="mt-2">
            Someone needs to build the shortcut and share the link first. Until then, follow the steps below, or just
            type your steps in on the challenge page.
          </p>
        </section>
      )}

      {/* ── Everything else, out of the way ── */}
      <Panel title="What that automation does">
        <p>
          Your steps send every time you open that app. Usually dozens of times a day, so the leaderboard keeps up
          without you thinking about it.
        </p>
        <p>Each send replaces the last one, so nothing double counts.</p>
        <p className="text-neutral-500">
          Prefer set times? Use a <strong>Time of Day</strong> automation instead. Apple only lets those repeat daily,
          so add a few: midday, 4pm, 8pm and 11:30pm.
        </p>
      </Panel>

      <Panel title="What we can see">
        <p>
          <strong className="text-neutral-800">Only a step count and a date.</strong> Nothing else from Health. No
          heart rate, no workouts, no location, no sleep.
        </p>
        <p>
          <strong className="text-neutral-800">Your phone does the sending.</strong> We have no way to reach into your
          Health app.
        </p>
        <p>
          <strong className="text-neutral-800">Stop any time</strong> using the button below, or by deleting the
          shortcut.
        </p>
      </Panel>

      <Panel title="Put it on your home screen">
        <p>
          In Safari, tap the share button, then <strong>Add to Home Screen</strong>. The portal opens like an app,
          and there is an <strong>Update my steps now</strong> button on the challenge page that runs the shortcut
          without leaving your phone.
        </p>
        <p className="text-neutral-500">
          Handy if you would rather check and update in one go than trust an automation to do it.
        </p>
      </Panel>

      <Panel title="Rather not bother?">
        <p>
          Type your daily total on the challenge page. Five seconds, nothing to set up, counts exactly the same.
        </p>
        <p>
          You can also upload a screenshot of your health app and we will read the number off it, then throw the
          picture away. That is the option for Android, which keeps step data locked to the phone.
        </p>
      </Panel>

      <details className="group mt-4 rounded-2xl border border-neutral-200 p-5">
        <summary className="cursor-pointer list-none text-sm font-bold text-neutral-900">
          Build the shortcut by hand
          <span className="ml-2 font-medium text-neutral-400 group-open:hidden">about 3 minutes</span>
        </summary>
        <p className="mt-3 text-sm text-neutral-600">
          In Shortcuts, tap <strong>+</strong> and add four actions:
        </p>
        <Steps
          items={[
            <>
              <strong>Text</strong>, containing your code above.
            </>,
            <>
              <strong>Find Health Samples</strong>. Type is <strong>Steps</strong>, and add a filter so the date{' '}
              <strong>is today</strong>.
            </>,
            <>
              <strong>Calculate Statistics</strong>, set to <strong>Sum</strong> of Health Samples.
            </>,
            <>
              <strong>Get Contents of URL</strong>. Paste the link below, set Method to <strong>POST</strong>, Request
              Body to <strong>JSON</strong>, then add a Number field called <code className="font-mono">steps</code>{' '}
              set to the Statistics result.
            </>,
          ]}
        />
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your personal link</p>
          <div className="mt-1 flex items-stretch gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-800">
              {personalUrl}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(personalUrl).catch(() => {})}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              aria-label="Copy your personal link"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-neutral-500">
          No headers to set. The link carries who you are.
        </p>
      </details>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3 border-t border-neutral-200 pt-5">
        <button
          type="button"
          onClick={disconnect}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          <Link2Off className="h-4 w-4" aria-hidden="true" /> Stop sending my steps
        </button>
        <button
          type="button"
          onClick={connect}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          New code
        </button>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Stopping leaves your logged steps alone. A new code stops the old one working, so update your shortcut if you
        make one.
      </p>
    </div>
  )
}
