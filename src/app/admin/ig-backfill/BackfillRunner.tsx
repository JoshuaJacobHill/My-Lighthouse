'use client'

import * as React from 'react'
import { Loader2, Play, Square } from 'lucide-react'

/**
 * Drive the Instagram backfill to completion.
 *
 * The work itself cannot run for more than a minute — Vercel kills the
 * function — so the endpoint reads as far as it can and hands back a cursor.
 * Something has to keep calling it with that cursor, and the browser is the
 * honest place for that: the tab stays open, the session is already
 * authenticated, and whoever started it can watch it go and stop it.
 *
 * Which beats opening a URL, reading JSON, copying a cursor out of it and
 * pasting it into the address bar, an unknown number of times.
 */

type Slice = {
  ok: boolean
  done: boolean
  written: number
  scanned: number
  tookMs: number
  resumeFrom: string | null
  error?: string
}

export function BackfillRunner() {
  const [running, setRunning] = React.useState(false)
  const [written, setWritten] = React.useState(0)
  const [passes, setPasses] = React.useState(0)
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState('')
  const [log, setLog] = React.useState<string[]>([])

  // Read inside the loop rather than captured by it, so Stop takes effect on
  // the next pass instead of at the end of however many are left.
  const stop = React.useRef(false)
  const cursor = React.useRef<string | null>(null)

  const note = (line: string) => setLog((l) => [...l.slice(-40), line])

  async function run() {
    setRunning(true)
    setError('')
    setDone(false)
    stop.current = false

    try {
      for (;;) {
        if (stop.current) {
          note('Stopped. Press start to carry on from here.')
          break
        }

        const qs = new URLSearchParams({ posts: '400' })
        if (cursor.current) qs.set('after', cursor.current)

        const res = await fetch(`/api/admin/ig-backfill?${qs}`, { cache: 'no-store' })
        const slice = (await res.json()) as Slice

        if (!res.ok || !slice.ok) {
          setError(slice.error ?? `The backfill failed (${res.status}).`)
          note(`Failed: ${slice.error ?? res.status}`)
          break
        }

        setPasses((n) => n + 1)
        setWritten((n) => n + slice.written)
        cursor.current = slice.resumeFrom
        note(
          `Pass ${passes + 1}: ${slice.written} posts in ${Math.round(slice.tookMs / 1000)}s` +
            (slice.done ? ' — reached the end' : ''),
        )

        if (slice.done || !slice.resumeFrom) {
          setDone(true)
          break
        }
      }
    } catch (e) {
      // A network drop mid-pass loses that pass, not the run: the cursor from
      // the last successful pass is still here, so starting again resumes.
      setError((e as Error).message || 'Lost connection.')
      note('Lost connection — press start to resume.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mt-7 rounded-[28px] border border-neutral-200 p-6">
      <div className="flex flex-wrap items-center gap-4">
        {running ? (
          <button
            onClick={() => { stop.current = true }}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold"
          >
            <Square className="h-4 w-4" aria-hidden="true" /> Stop after this pass
          </button>
        ) : (
          <button
            onClick={run}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {passes > 0 && !done ? 'Carry on' : 'Start the backfill'}
          </button>
        )}

        {running && (
          <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading… each pass takes about a minute
          </span>
        )}
      </div>

      {(passes > 0 || written > 0) && (
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <div className="text-3xl font-extrabold tabular-nums tracking-tight">{written}</div>
            <div className="text-xs text-neutral-500">posts written</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold tabular-nums tracking-tight">{passes}</div>
            <div className="text-xs text-neutral-500">passes</div>
          </div>
        </div>
      )}

      {done && (
        <p className="mt-5 rounded-2xl bg-lime-50 p-4 text-sm leading-relaxed text-lime-900">
          Finished — that is the whole back catalogue Instagram will give us. The nightly job keeps
          it up to date from here.
        </p>
      )}

      {error && (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-700">
          {error} Nothing already written was lost — press start to pick up where it stopped.
        </p>
      )}

      {log.length > 0 && (
        <ul className="mt-5 space-y-1 border-t border-neutral-100 pt-4 font-mono text-xs text-neutral-500">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
