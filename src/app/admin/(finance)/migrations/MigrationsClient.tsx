'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Send, X, Upload, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseMigrationCsv } from '@/lib/migration-csv'
import {
  importMigrationIntentsAction,
  sendMigrationEmailAction,
  sendAllPendingMigrationEmailsAction,
  cancelMigrationIntentAction,
} from '@/lib/actions/migration.actions'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

interface FundOption {
  slug: string
  name: string
}
interface IntentRow {
  id: string
  token: string
  email: string
  donorName: string | null
  donorCompany: string | null
  amountCents: number
  frequency: string
  status: string
  emailSentAt: string | null
  completedAt: string | null
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export function MigrationsClient({ funds, intents }: { funds: FundOption[]; intents: IntentRow[] }) {
  const router = useRouter()
  const [fundSlug, setFundSlug] = React.useState(funds[0]?.slug ?? '')
  const [csv, setCsv] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const [notice, setNotice] = React.useState<string | null>(null)

  const preview = React.useMemo(() => (csv.trim() ? parseMigrationCsv(csv) : []), [csv])
  const validCount = preview.filter((r) => r.ok).length
  const invalidCount = preview.length - validCount

  const pendingCount = intents.filter((i) => i.status === 'PENDING').length

  function runImport() {
    setNotice(null)
    startTransition(async () => {
      const res = await importMigrationIntentsAction({ csv, fundSlug })
      if (!res.success) {
        setNotice(res.error ?? 'Import failed.')
        return
      }
      setCsv('')
      setNotice(
        `Imported ${res.created} donor${res.created === 1 ? '' : 's'}` +
          (res.skipped ? `, skipped ${res.skipped} already pending` : '') +
          (res.invalid ? `, ${res.invalid} invalid row${res.invalid === 1 ? '' : 's'} ignored` : '') +
          '.'
      )
      router.refresh()
    })
  }

  function sendOne(id: string) {
    startTransition(async () => {
      const res = await sendMigrationEmailAction(id)
      setNotice(res.success ? 'Email sent.' : res.error ?? 'Could not send.')
      router.refresh()
    })
  }

  function sendAll() {
    if (!confirm(`Send the re-confirm email to all ${pendingCount} pending donor(s)?`)) return
    startTransition(async () => {
      const res = await sendAllPendingMigrationEmailsAction()
      setNotice(`Sent ${res.sent} email(s)${res.failed ? `, ${res.failed} failed` : ''}.`)
      router.refresh()
    })
  }

  function cancel(id: string) {
    if (!confirm('Cancel this donor’s migration? Their link will stop working.')) return
    startTransition(async () => {
      await cancelMigrationIntentAction(id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {notice && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {notice}
        </div>
      )}

      {/* Importer */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Upload className="h-5 w-5 text-orange-500" /> Import donors
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Paste a CSV with columns <code className="rounded bg-gray-100 px-1">name, email, company, amount, frequency</code>.
          Amount in dollars; frequency is weekly, fortnightly or monthly. A header row is optional.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fund these gifts support</label>
            <select
              value={fundSlug}
              onChange={(e) => setFundSlug(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {funds.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-400">Applied to every row in this import.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">CSV data</label>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={7}
              placeholder={'Jane Smith,jane@example.com,Acme Pty Ltd,50,monthly\nJohn Doe,john@example.com,,25,fortnightly'}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {preview.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-green-700">{validCount} valid</span>
              {invalidCount > 0 && <span className="font-semibold text-red-600"> · {invalidCount} invalid</span>}
            </p>
            <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Gift</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((r, i) => (
                    <tr key={i} className={r.ok ? '' : 'bg-red-50'}>
                      <td className="px-3 py-2">{r.name || '—'}</td>
                      <td className="px-3 py-2">{r.email || '—'}</td>
                      <td className="px-3 py-2">
                        {r.ok ? `${aud.format(r.amountCents / 100)} ${r.frequency}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-red-600">{r.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Button onClick={runImport} disabled={pending || validCount === 0 || !fundSlug}>
            {pending ? 'Working…' : `Import ${validCount || ''} donor${validCount === 1 ? '' : 's'}`}
          </Button>
        </div>
      </section>

      {/* Intents list */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Users className="h-5 w-5 text-orange-500" /> Migrating donors
            <span className="text-sm font-normal text-gray-400">({intents.length})</span>
          </h2>
          {pendingCount > 0 && (
            <Button onClick={sendAll} disabled={pending} size="sm">
              <Send className="mr-1.5 h-4 w-4" /> Send all pending ({pendingCount})
            </Button>
          )}
        </div>

        {intents.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">
            No donors imported yet. Paste a CSV above to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Donor</th>
                  <th className="px-6 py-3 font-medium">Gift</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {intents.map((i) => (
                  <IntentTableRow
                    key={i.id}
                    intent={i}
                    disabled={pending}
                    onSend={() => sendOne(i.id)}
                    onCancel={() => cancel(i.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function IntentTableRow({
  intent,
  disabled,
  onSend,
  onCancel,
}: {
  intent: IntentRow
  disabled: boolean
  onSend: () => void
  onCancel: () => void
}) {
  const [copied, setCopied] = React.useState(false)

  function copyLink() {
    const link = `${window.location.origin}/give/resume/${intent.token}`
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const isPending = intent.status === 'PENDING'

  return (
    <tr>
      <td className="px-6 py-3">
        <p className="font-medium text-gray-900">{intent.donorName || '—'}</p>
        <p className="text-xs text-gray-500">{intent.email}</p>
        {intent.donorCompany && <p className="text-xs text-gray-400">{intent.donorCompany}</p>}
      </td>
      <td className="px-6 py-3 text-gray-700">
        {aud.format(intent.amountCents / 100)} <span className="text-gray-400">{intent.frequency}</span>
      </td>
      <td className="px-6 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[intent.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {intent.status.toLowerCase()}
        </span>
      </td>
      <td className="px-6 py-3 text-xs text-gray-500">
        {intent.emailSentAt ? `Sent ${new Date(intent.emailSentAt).toLocaleDateString('en-AU')}` : 'Not sent'}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center justify-end gap-2">
          {isPending && (
            <>
              <button
                type="button"
                onClick={copyLink}
                title="Copy re-confirm link"
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Link'}
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {intent.emailSentAt ? 'Resend' : 'Send'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={disabled}
                title="Cancel"
                className="inline-flex items-center rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
