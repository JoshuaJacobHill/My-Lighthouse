import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireCapability } from '@/lib/permissions'
import { getBridgeStatus } from '@/lib/gap-bridge'
import { BridgeControls } from './BridgeControls'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'POS bridge' }

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting to send',
  SENT: 'Sent to Meta',
  SKIPPED_NO_CUSTOMER: 'No customer attached',
  SKIPPED_TRAN_TYPE: 'Not a normal sale',
  SKIPPED_IDENTIFIERS_OFF: 'Held — matching switched off',
  FAILED: 'Failed',
}

function Pill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={
        'rounded-full px-2.5 py-1 text-xs font-bold ' +
        (on ? 'bg-lime-100 text-lime-800' : 'bg-neutral-100 text-neutral-600')
      }
    >
      {on ? onLabel : offLabel}
    </span>
  )
}

export default async function BridgePage() {
  await requireCapability('business.reports')
  const status = await getBridgeStatus()

  const when = (d: Date) =>
    new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Brisbane',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)

  return (
    <div className="-m-4 min-h-full bg-white lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/business"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Sales &amp; marketing
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">POS bridge</h1>
        <p className="mt-2 max-w-xl text-neutral-500">
          Reads completed sales from Gap Solutions every ten minutes. They feed the in-store half of
          the sales report, and — once customer matching is switched on — go to Meta as in-store
          Purchase events so ads can be measured against real trade.
        </p>

        {/* ── How it is configured right now ── */}
        <div className="mt-7 rounded-[28px] border border-neutral-200 p-5">
          <h2 className="text-lg font-bold">Settings</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Gap Solutions connection</dt>
              <dd>
                <Pill on={status.configured.emc} onLabel="Configured" offLabel="Not configured" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Stores</dt>
              <dd className="text-right text-sm">
                {status.stores.length === 0 ? (
                  <Pill on={false} onLabel="" offLabel="None configured" />
                ) : (
                  <span className="font-semibold text-neutral-800">
                    {status.stores.map((s) => `${s.name} (#${s.id})`).join(' · ')}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Meta dataset</dt>
              <dd className="flex items-center gap-2">
                {status.settings.datasetId && (
                  <span className="font-mono text-xs text-neutral-500">
                    {status.settings.datasetId}
                  </span>
                )}
                <Pill on={status.configured.meta} onLabel="Configured" offLabel="Not configured" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Sending to Meta</dt>
              <dd>
                <Pill
                  on={!status.settings.dryRun}
                  onLabel="Live"
                  offLabel="Dry run — nothing is sent"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Customer matching</dt>
              <dd>
                <Pill
                  on={status.settings.sendIdentifiers}
                  onLabel="On — hashed identifiers sent"
                  offLabel="Off"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Meta test events</dt>
              <dd>
                {status.settings.testEventCode ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                    {status.settings.testEventCode}
                  </span>
                ) : (
                  <Pill on onLabel="Live events" offLabel="Live events" />
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            To add another shop, set <code className="font-mono">EMC_HILLCREST_STORE_ID</code> (or{' '}
            <code className="font-mono">EMC_&lt;NAME&gt;_STORE_ID</code>) to its Gap Solutions store
            ID. The name becomes the store&rsquo;s label in the sales report, so spell it the way the
            report does. No code change needed.
          </p>

          {status.settings.sendIdentifiers ? null : (
            <p className="mt-4 rounded-2xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
              Customer matching is off, so sales are recorded and counted but no identifiers go to
              Meta. Turn it on with <code className="font-mono">SEND_CUSTOMER_IDENTIFIERS=true</code>{' '}
              only once our privacy notice covers using hashed customer details with Meta for
              advertising measurement. A customer&rsquo;s unticked marketing box in the POS is about
              being emailed — it is not that decision.
            </p>
          )}
        </div>

        {/* ── What has happened ── */}
        <div className="mt-6 rounded-[28px] border border-neutral-200 p-5">
          <h2 className="text-lg font-bold">Last run</h2>
          {status.lastRun ? (
            <p className="mt-2 text-sm text-neutral-600">
              {when(status.lastRun.at)} ·{' '}
              {status.lastRun.finishedAt ? (
                status.lastRun.ok ? (
                  <span className="font-semibold text-lime-700">succeeded</span>
                ) : (
                  <span className="font-semibold text-red-700">failed</span>
                )
              ) : (
                <span className="font-semibold text-amber-700">still running</span>
              )}{' '}
              · {status.lastRun.rows} sales inspected
            </p>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Has not run yet.</p>
          )}
          {status.lastRun?.error && (
            <p className="mt-2 rounded-2xl bg-red-50 p-3 font-mono text-xs text-red-700">
              {status.lastRun.error}
            </p>
          )}

          <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Today in store
            </p>
            <p className="mt-1 text-2xl font-extrabold">{money(status.today.revenueCents)}</p>
            <p className="text-sm text-neutral-500">{status.today.orders} sales</p>
          </div>

          {status.counts.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {status.counts.map((c) => (
                <li key={c.status} className="flex justify-between gap-3">
                  <span className="text-neutral-600">{STATUS_LABEL[c.status] ?? c.status}</span>
                  <span className="font-semibold tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {status.recentFailures.length > 0 && (
          <div className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-5">
            <h2 className="text-lg font-bold text-red-900">Recent failures</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {status.recentFailures.map((f) => (
                <li key={f.saleIdentifier}>
                  <p className="font-mono text-xs text-red-900">{f.saleIdentifier}</p>
                  <p className="text-xs text-red-700">
                    {when(f.occurredAt)} · attempt {f.attemptCount} · {f.lastError}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <BridgeControls dryRun={status.settings.dryRun} />
      </div>
    </div>
  )
}
