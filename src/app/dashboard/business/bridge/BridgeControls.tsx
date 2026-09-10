'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { diagnoseGapAction, runBridgeNowAction, testSaleAction } from '@/lib/actions/gap.actions'
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
          — which fields were hashed, never what they were.
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
