'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Copy, Check, Smartphone, Link2Off, Download } from 'lucide-react'
import { connectFitnessAction, disconnectFitnessAction } from '@/lib/actions/fitness.actions'

interface Props {
  initialToken: string | null
  appUrl: string
  /** iCloud link to the ready-made shortcut, if one has been set up. */
  shortcutUrl: string | null
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

export function ConnectHealth({ initialToken, appUrl, shortcutUrl, lastUsedAt, lastAmount }: Props) {
  const router = useRouter()
  const [token, setToken] = React.useState(initialToken)
  const personalUrl = `${appUrl}/api/fitness/steps/${encodeURIComponent(token ?? '')}`
  const [codeCopied, setCodeCopied] = React.useState(false)

  async function copyCode() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1800)
    } catch {
      // Clipboard is blocked in some in-app browsers — the code is short
      // enough to read off the screen, which is rather the point.
    }
  }
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
        Do this on the phone itself. Your personal link is below &mdash; it&rsquo;s the only thing that&rsquo;s yours
        alone, so don&rsquo;t pass it on.
      </p>

      <div className="mt-4 rounded-2xl border border-neutral-900 bg-neutral-950 p-5 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Your personal code</p>
        <p className="mt-1.5 font-mono text-3xl font-bold tracking-[0.12em]">{token}</p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
        >
          {codeCopied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {codeCopied ? 'Copied' : 'Copy code'}
        </button>
        <p className="mt-3 text-xs text-white/50">
          Short enough to type if pasting plays up. Yours alone &mdash; don&rsquo;t pass it on.
        </p>
      </div>

      <details className="mt-3 rounded-xl border border-neutral-200 px-4 py-3">
        <summary className="cursor-pointer list-none text-xs font-semibold text-neutral-500">
          Prefer the full link?
        </summary>
        <CopyField label="Your personal link" value={personalUrl} />
      </details>

      {shortcutUrl ? (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <p className="text-sm font-bold text-neutral-900">The quick way</p>
          <ol className="mt-2 space-y-2 text-sm text-neutral-600">
            <li>
              <strong>1.</strong> Copy the code above (or just remember it — it&rsquo;s eight characters).
            </li>
            <li>
              <strong>2.</strong> Tap the button below and choose <strong>Add Shortcut</strong>. It&rsquo;ll ask for
              your code &mdash; type or paste it in.
            </li>
            <li>
              <strong>3.</strong> Run it once and allow Health access when asked. That&rsquo;s the opt-in.
            </li>
            <li>
              <strong>4.</strong> In the <strong>Automation</strong> tab, add an <strong>App</strong> automation:
              something you open often, <strong>Is Opened</strong>, <strong>Run Immediately</strong>. Your steps
              then update all through the day on their own.
            </li>
          </ol>
          <a
            href={shortcutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Add the shortcut to my phone
          </a>
          <p className="mt-3 text-xs text-neutral-500">
            Opens the Shortcuts app, which comes with your iPhone. Nothing is sent until you run it.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          <p className="font-bold text-neutral-900">One-tap install isn&rsquo;t ready yet</p>
          <p className="mt-1">
            Someone needs to build the shortcut once and share the link before everyone else can install it. Until
            then, follow the steps below &mdash; or just type your steps in on the challenge page, which is
            genuinely fine.
          </p>
        </div>
      )}

      <details className="group mt-6 rounded-2xl border border-neutral-200 p-5">
        <summary className="cursor-pointer list-none text-sm font-bold text-neutral-900">
          Build it by hand instead
          <span className="ml-2 font-medium text-neutral-400 group-open:hidden">(about 3 minutes)</span>
        </summary>

        <ol className="mt-5">
          <Step n={1} title="Open Shortcuts and make a new one">
            <p>
              The Shortcuts app comes with your iPhone. Tap <strong>+</strong>, and name it{' '}
              <strong>Send my steps</strong>.
            </p>
          </Step>

          <Step n={2} title="Add “Find Health Samples”">
            <p>
              Search for <strong>Find Health Samples</strong> and add it. Set <strong>Type</strong> to{' '}
              <strong>Steps</strong>, then add a filter so the date <strong>is today</strong>.
            </p>
            <p>Health will ask permission the first time you run it — that&rsquo;s the opt-in.</p>
          </Step>

          <Step n={3} title="Add up the day">
            <p>
              Add <strong>Calculate Statistics</strong>, set to <strong>Sum</strong> of{' '}
              <strong>Health Samples</strong>. That&rsquo;s today&rsquo;s total, as one number.
            </p>
          </Step>

          <Step n={4} title="Send it across">
            <p>
              Add <strong>Get Contents of URL</strong> and paste your personal link from above. Tap the arrow to
              expand it, set <strong>Method</strong> to <strong>POST</strong>, choose{' '}
              <strong>Request Body: JSON</strong>, and add a <strong>Number</strong> field called{' '}
              <code className="font-mono">steps</code> set to the <strong>Statistics</strong> result from step 3.
            </p>
            <p className="text-neutral-500">
              No headers to set — your link carries who you are.
            </p>
          </Step>

          <Step n={5} title="Make it run by itself">
            <p>
              Go to the <strong>Automation</strong> tab and tap <strong>+</strong>. The obvious choice is{' '}
              <strong>Time of Day</strong>, but Apple only lets those repeat once a day &mdash; so the better one is{' '}
              <strong>App</strong>.
            </p>
            <p>
              Choose <strong>App</strong>, pick something you open all the time (Messages, Instagram, your
              bank &mdash; whatever), set it to <strong>Is Opened</strong>, then{' '}
              <strong>Run Immediately</strong> with <strong>Notify When Run</strong> turned off. Pick your{' '}
              <strong>Send my steps</strong> shortcut.
            </p>
            <p className="rounded-xl bg-neutral-100 px-3.5 py-2.5 text-neutral-700">
              That&rsquo;s the whole trick: your steps now go up every time you open that app &mdash; dozens of times
              a day, without you thinking about it. One automation instead of sixteen.
            </p>
            <p className="text-neutral-500">
              Each send replaces the last, so nothing double-counts however often it runs. If you&rsquo;d rather have
              set times, a Time of Day automation works too &mdash; just add a few (12&nbsp;pm, 4&nbsp;pm,
              8&nbsp;pm, 11:30&nbsp;pm), since each one can only repeat daily.
            </p>
          </Step>

          <Step n={6} title="Test it">
            <p>
              Tap play. Allow Health access, then check the challenge page — today&rsquo;s steps should be there.
            </p>
          </Step>
        </ol>
      </details>

      <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-800">Not keen on any of this?</p>
        <p className="mt-1">
          Perfectly fine. On the challenge page you can type your daily total straight in, or upload a screenshot of
          your health app and we&rsquo;ll read the number off it and throw the picture away. Both count exactly the
          same as the automatic version &mdash; and neither needs setting up. Android users, that&rsquo;s your lot
          anyway: Android keeps step data locked to the phone and has no equivalent of Shortcuts.
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
