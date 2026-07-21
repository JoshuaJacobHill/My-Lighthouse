'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toggleFundActiveAction } from '@/lib/actions/fund.actions'

export interface FundRow {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  showPublicProgress: boolean
  goalAmount: number | null
  raised: number
  donateUrl: string
  embedSnippet: string
}

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function CopyButton({
  value,
  label,
  ariaLabel,
}: {
  value: string
  label: string
  ariaLabel: string
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — no-op; the text is still visible to copy manually.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
      aria-label={ariaLabel}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> {label}
        </>
      )}
    </button>
  )
}

function FundCard({ fund }: { fund: FundRow }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function toggleActive() {
    setBusy(true)
    const result = await toggleFundActiveAction(fund.id, !fund.isActive)
    setBusy(false)
    if (result.success) router.refresh()
  }

  const pct =
    fund.goalAmount && fund.goalAmount > 0
      ? Math.min(100, Math.round((fund.raised / fund.goalAmount) * 100))
      : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-gray-900">{fund.name}</h2>
            {fund.isActive ? (
              <Badge variant="ACTIVE">Active</Badge>
            ) : (
              <Badge variant="INACTIVE">Inactive</Badge>
            )}
          </div>
          {fund.description && (
            <p className="mt-1 text-sm text-gray-500">{fund.description}</p>
          )}
        </div>
        <Link
          href={`/admin/funds/${fund.id}/edit`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-orange-600"
        >
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-bold text-gray-900">{aud.format(fund.raised)}</span>
        <span className="text-sm text-gray-400">
          raised{fund.goalAmount ? ` of ${aud.format(fund.goalAmount)} goal` : ''}
        </span>
      </div>

      {pct !== null && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <code className="min-w-0 flex-1 truncate rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
          {fund.donateUrl}
        </code>
        <CopyButton value={fund.donateUrl} label="Copy link" ariaLabel="Copy donate link" />
        <button
          type="button"
          onClick={toggleActive}
          disabled={busy}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          {fund.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {fund.showPublicProgress && (
        <div className="mt-3 rounded-lg bg-orange-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">
              Embed this progress bar on WordPress
            </p>
            <CopyButton
              value={fund.embedSnippet}
              label="Copy embed"
              ariaLabel="Copy embed code"
            />
          </div>
          <code className="mt-2 block overflow-x-auto whitespace-pre rounded-md bg-white px-2.5 py-2 text-[11px] leading-relaxed text-gray-600">
            {fund.embedSnippet}
          </code>
        </div>
      )}
    </div>
  )
}

export function FundsList({ funds }: { funds: FundRow[] }) {
  if (funds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-sm text-gray-500">
          No funds yet. Create your first designation — for example a General
          fund, Christmas Appeal, or Good Food Hampers.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {funds.map((fund) => (
        <FundCard key={fund.id} fund={fund} />
      ))}
    </div>
  )
}
