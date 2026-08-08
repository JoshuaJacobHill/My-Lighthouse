'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Repeat, Pencil, Check, X } from 'lucide-react'
import { updateTitheAmountAction } from '@/lib/actions/tithe.actions'
import { cancelMyRecurringGift } from '@/lib/actions/recurring.actions'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

const fmtDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

export interface TitheView {
  id: string
  amount: number
  frequencyLabel: string
  status: string
  statusLabel: string
  active: boolean
  nextChargeAt: number | null
  endedAt: number | null
}

export function TitheManager({ tithe }: { tithe: TitheView }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState(false)
  const [amountText, setAmountText] = React.useState(String(tithe.amount))
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function save() {
    const n = Number(amountText)
    if (!Number.isFinite(n) || n < 2) {
      setError('Please enter at least $2.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateTitheAmountAction(tithe.id, n)
      if (!res.success) {
        setError(res.error ?? 'Could not update.')
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function cancel() {
    if (!confirm('Cancel your regular tithe? You can start a new one any time.')) return
    startTransition(async () => {
      await cancelMyRecurringGift(tithe.id, 'CHURCH')
      router.refresh()
    })
  }

  const badge = tithe.active
    ? tithe.status === 'active' || tithe.status === 'trialing'
      ? 'bg-green-100 text-green-800'
      : 'bg-amber-100 text-amber-800'
    : 'bg-gray-100 text-gray-600'

  return (
    <div className={`rounded-[28px] border bg-white p-6 ${tithe.active ? 'border-gray-200' : 'border-gray-200 opacity-75'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${tithe.active ? 'bg-orange-500' : 'bg-gray-300'}`}>
            <Repeat className="h-6 w-6" />
          </span>
          <div>
            {editing ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">$</span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-2xl font-bold focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <span className="text-gray-500">· {tithe.frequencyLabel}</span>
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">
                {aud.format(tithe.amount)}{' '}
                <span className="text-base font-normal text-gray-500">· {tithe.frequencyLabel}</span>
              </p>
            )}
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>{tithe.statusLabel}</span>
              {tithe.active && tithe.nextChargeAt
                ? `next ${fmtDate(tithe.nextChargeAt)}`
                : tithe.endedAt
                  ? `cancelled ${fmtDate(tithe.endedAt)}`
                  : ''}
            </p>
          </div>
        </div>

        {tithe.active && (
          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={save}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setAmountText(String(tithe.amount))
                    setError(null)
                  }}
                  className="inline-flex items-center rounded-full border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
                  aria-label="Cancel edit"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-600"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit amount
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {tithe.active && !editing && (
        <button type="button" onClick={cancel} disabled={pending} className="mt-4 text-sm font-medium text-gray-400 hover:text-red-600">
          Cancel this tithe
        </button>
      )}
    </div>
  )
}
