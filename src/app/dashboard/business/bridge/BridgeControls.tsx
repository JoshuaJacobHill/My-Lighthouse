'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  coverageAction,
  diagnoseGapAction,
  runBridgeNowAction,
  testSaleAction,
} from '@/lib/actions/gap.actions'
import type { Coverage } from '@/lib/gap-bridge'
import type { SalesProbe } from '@/lib/integrations/gap'

/**
 * Run the bridge by hand, and test one known sale.
 *
 * The single-sale test goes through exactly the same code as the poll,
 * persistence included — so a sale tested here is recorded and the next cycle
 * will not send it again. That is the point: a test that took a different path
 * would prove nothing about the real one.
 */

type Line = { tone: 'ok' | 'warn' | 'bad'; text: string }

function Result({ lines }: { lines: Line[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {lines.map((l, i) => (
        <li
          key={i}
          className={
            l.tone === 'ok' ? 'text-lime-700' : l.tone === 'warn' ? 'text-amber-700' : 'text-red-700'
          }
        >
          {l.text}
        </li>
      ))}
    </ul>
  )
}

export function BridgeControls({ dryRun }: { dryRun: boolean }) {
  const [pending, startTransition] = React.useTransition()
  const [runLines, setRunLines] = React.useState<Line[]>([])
  const [saleId, setSaleId] = React.useState('')
  const [testLines, setTestLines] = React.useState<Line[]>([])
  const [lookback, setLookback] = React.useState('60')
  const [probes, setProbes] = React.useState<SalesProbe[] | null>(null)
  const [probeError, setProbeError] = React.useState('')
  const [coverage, setCoverage] = React.useState<Coverage | null>(null)
  const [coverageError, setCoverageError] = React.useState('')

  function run() {
    setRunLines([])
    startTransition(async () => {
      const res = await runBridgeNowAction(Number(lookback))
      const s = res.summary
      if (!s) {
        setRunLines([{ tone: 'bad', text: res.error ?? 'Something went wrong.' }])
        return
      }
      if (s.skippedRun === 'already_running') {
        setRunLines([{ tone: 'warn', text: 'A run is already in progress — skipped this one.' }])
        return
      }
      if (s.skippedRun === 'not_configured') {
        setRunLines([{ tone: 'bad', text: 'Gap Solutions credentials are not configured.' }])
        return
      }
      setRunLines([
        {
          tone: s.ok ? 'ok' : 'bad',
          text: s.ok ? `Inspected ${s.inspected} sales.` : `Run failed: ${s.error}`,
        },
        { tone: 'ok', text: `${s.sent} sent · ${s.skipped} skipped · ${s.failed} failed` },
        { tone: 'ok', text: `${s.daysRolledUp} day(s) rolled into the sales report` },
        ...(s.notes ?? []).map((n) => ({ tone: 'bad' as const, text: `Possible truncation — ${n}` })),
        ...(s.dryRun ? [{ tone: 'warn' as const, text: 'Dry run — nothing was sent to Meta.' }] : []),
      ])
    })
  }

  function test() {
    setTestLines([])
    startTransition(async () => {
      const res = await testSaleAction(Number(saleId))
      if (!res.success || !res.outcome) {
        setTestLines([{ tone: 'bad', text: res.error ?? 'Something went wrong.' }])
        return
      }
      const o = res.outcome
      setTestLines([
        { tone: 'ok', text: `Sale ${o.saleIdentifier} · $${o.valueAud.toFixed(2)}` },
        {
          tone: o.status === 'SENT' ? 'ok' : o.status === 'FAILED' ? 'bad' : 'warn',
          text: `Result: ${o.status}${o.reason ? ` (${o.reason})` : ''}`,
        },
        ...(o.matchKeys
          ? [{ tone: 'ok' as const, text: `Matching fields hashed: ${o.matchKeys}` }]
          : []),
        ...(res.dryRun ? [{ tone: 'warn' as const, text: 'Dry run — nothing was sent to Meta.' }] : []),
      ])
    })
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-[28px] border border-neutral-200 p-5">
        <h2 className="text-lg font-bold">Run a cycle now</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Runs on its own once a day at 21:30, looking back twenty-five hours. Widen the window to
          catch up after an outage — already-handled sales are skipped, so it is safe to re-run.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Look back (minutes)</span>
            <input
              type="number"
              min={1}
              value={lookback}
              onChange={(e) => setLookback(e.target.value)}
              className="w-32 rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Run now
          </button>
        </div>
        <Result lines={runLines} />
      </div>

      <div className="rounded-[28px] border border-neutral-200 p-5">
        <h2 className="text-lg font-bold">Test one sale</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Give it a Gap Solutions sale header ID. It runs the real path and shows a redacted summary
          — which fields were hashed, never what they were. Works on sales already recorded, and
          never sends one twice.
          {dryRun ? ' Dry run is on, so nothing will reach Meta.' : ''}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Sale header ID</span>
            <input
              type="number"
              min={1}
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
              placeholder="123456"
              className="w-44 rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>
          <button
            type="button"
            onClick={test}
            disabled={pending || !saleId}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Test sale
          </button>
        </div>
        <Result lines={testLines} />
      </div>

      {/* The question that decides whether any of this is worth switching on:
          is there enough customer data for Meta to match anybody? */}
      <div className="rounded-[28px] border border-neutral-200 p-5">
        <h2 className="text-lg font-bold">Can Meta match these customers?</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Checks the most recent sales for the details Meta matches on. Counts only — the values are
          read to test them and thrown away, and nothing is stored or logged.
        </p>
        <button
          type="button"
          onClick={() => {
            setCoverage(null)
            setCoverageError('')
            startTransition(async () => {
              const res = await coverageAction(25)
              if (!res.success || !res.coverage) {
                setCoverageError(res.error ?? 'Something went wrong.')
                return
              }
              setCoverage(res.coverage)
            })
          }}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Check match coverage
        </button>

        {coverageError && <p className="mt-3 text-sm text-red-700">{coverageError}</p>}

        {coverage && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { n: coverage.sampled, label: 'sales checked' },
                { n: coverage.withCustomer, label: 'have a customer' },
                { n: coverage.matchable, label: 'Meta can match' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-neutral-50 p-4 text-center">
                  <p className="text-2xl font-extrabold tabular-nums">{s.n}</p>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                </div>
              ))}
            </div>

            {coverage.withCustomer > 0 && (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                    <th className="py-2">Field</th>
                    <th className="py-2 text-right">Filled in</th>
                    <th className="py-2 text-right">Meta can use</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.fields.map((f) => (
                    <tr key={f.key} className="border-b border-neutral-100">
                      <td className="py-2">{f.label}</td>
                      <td className="py-2 text-right tabular-nums">
                        {f.present}/{coverage.withCustomer}
                      </td>
                      <td
                        className={
                          'py-2 text-right font-bold tabular-nums ' +
                          (f.usable < f.present ? 'text-amber-700' : 'text-neutral-800')
                        }
                      >
                        {f.usable}/{coverage.withCustomer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {coverage.fields.some((f) => f.reasons.length > 0) && (
              <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <p className="font-semibold">What was dropped, and why</p>
                <ul className="mt-1.5 space-y-1">
                  {coverage.fields.flatMap((f) =>
                    f.reasons.map((r) => (
                      <li key={`${f.key}-${r.reason}`}>
                        <span className="font-semibold">{f.label}</span> · {r.count} × {r.reason}
                      </li>
                    )),
                  )}
                </ul>
                <p className="mt-2">
                  These are dropped rather than sent wrong: a hash that matches nobody still looks
                  like data to Meta, and drags the match quality down with it. All fixable at the
                  counter.
                </p>
              </div>
            )}

            {coverage.customerFields.length > 0 && (
              <details className="mt-4 rounded-2xl bg-neutral-50 p-4">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Every field on the customer record ({coverage.customerFields.length})
                </summary>
                <p className="mt-2 text-xs text-neutral-500">
                  Field names and how many held a value, out of {coverage.withCustomer}. Names only
                  — no contents are read. Here so anything worth adding next, like city and state,
                  can be read off rather than guessed at.
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-neutral-700 sm:grid-cols-3">
                  {coverage.customerFields.map((f) => (
                    <li key={f.name} className={f.filled === 0 ? 'text-neutral-400' : undefined}>
                      {f.name} <span className="tabular-nums">({f.filled})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {coverage.withCustomer === 0 && (
              <p className="mt-3 text-sm text-neutral-600">
                None of the sales checked had a customer attached, so there is nothing for Meta to
                match. That is a counter habit rather than a technical problem.
              </p>
            )}
          </div>
        )}
      </div>

      {/* For the case a run succeeds having inspected nothing. A 200 with an
          empty list looks identical to "no sales happened", so ask several
          ways and compare. */}
      <div className="rounded-[28px] border border-neutral-200 p-5">
        <h2 className="text-lg font-bold">Why did it find nothing?</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Asks Gap Solutions for the same period several different ways and shows what each returns.
          If the sixty-minute window comes back empty but the same window sent as UTC has rows, their
          dates are UTC and ours are wrong. Sale headers only — no customer detail is read.
        </p>
        <button
          type="button"
          onClick={() => {
            setProbes(null)
            setProbeError('')
            startTransition(async () => {
              const res = await diagnoseGapAction(Number(lookback) || 60)
              if (!res.success || !res.probes) {
                setProbeError(res.error ?? 'Something went wrong.')
                return
              }
              setProbes(res.probes)
            })
          }}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Diagnose
        </button>

        {probeError && <p className="mt-3 text-sm text-red-700">{probeError}</p>}

        {probes && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3">How we asked</th>
                  <th className="py-2 pr-3">HTTP</th>
                  <th className="py-2 pr-3">Rows</th>
                  <th className="py-2">Shape</th>
                </tr>
              </thead>
              <tbody>
                {probes.map((p) => (
                  <tr key={p.label} className="border-b border-neutral-100 align-top">
                    <td className="py-2 pr-3">{p.label}</td>
                    <td className="py-2 pr-3 tabular-nums">{p.status || '—'}</td>
                    <td
                      className={
                        'py-2 pr-3 font-bold tabular-nums ' +
                        (p.count > 0 ? 'text-lime-700' : 'text-neutral-400')
                      }
                    >
                      {p.count}
                    </td>
                    <td className="py-2 font-mono text-xs text-neutral-500">
                      {p.error ?? p.shape}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {probes.find((p) => p.firstRow) && (
              <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  First row returned
                </p>
                <pre className="mt-2 overflow-x-auto text-xs text-neutral-700">
                  {JSON.stringify(probes.find((p) => p.firstRow)!.firstRow, null, 2)}
                </pre>
                <p className="mt-2 text-xs text-neutral-500">
                  Fields available:{' '}
                  <span className="font-mono">
                    {probes.find((p) => p.firstRowKeys)?.firstRowKeys?.join(', ')}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
