'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  addOfflineDonationAction,
  updateOfflineDonationAction,
  deleteOfflineDonationAction,
} from '@/lib/actions/fundraiser.actions'

export interface OfflineDonationRow {
  id: string
  donorName: string | null
  message: string | null
  amount: number
  date: string // formatted, for display
  donatedAt: string // yyyy-mm-dd, for the date input
}

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export function OfflineDonationsManager({
  fundraiserId,
  donations,
}: {
  fundraiserId: string
  donations: OfflineDonationRow[]
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [savingId, setSavingId] = React.useState<string | null>(null)
  // Draft values while editing a row.
  const [draft, setDraft] = React.useState<{ donorName: string; amount: string; donatedAt: string; message: string }>({
    donorName: '',
    amount: '',
    donatedAt: '',
    message: '',
  })
  const formRef = React.useRef<HTMLFormElement>(null)

  function startEdit(d: OfflineDonationRow) {
    setError(null)
    setEditingId(d.id)
    setDraft({
      donorName: d.donorName ?? '',
      amount: String(d.amount),
      donatedAt: d.donatedAt,
      message: d.message ?? '',
    })
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await addOfflineDonationAction({
      fundraiserId,
      donorName: (fd.get('donorName') as string) ?? '',
      amount: (fd.get('amount') as string) ?? '',
      donatedAt: (fd.get('donatedAt') as string) ?? '',
      message: (fd.get('message') as string) ?? '',
    })
    setLoading(false)
    if (result.success) {
      formRef.current?.reset()
      router.refresh()
    } else {
      setError(result.error ?? 'Could not add the donation.')
    }
  }

  async function handleSave(id: string) {
    setError(null)
    setSavingId(id)
    const result = await updateOfflineDonationAction(id, {
      donorName: draft.donorName,
      amount: draft.amount,
      donatedAt: draft.donatedAt,
      message: draft.message,
    })
    setSavingId(null)
    if (result.success) {
      setEditingId(null)
      router.refresh()
    } else {
      setError(result.error ?? 'Could not update the donation.')
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteOfflineDonationAction(id)
    if (result.success) router.refresh()
    else setError(result.error ?? 'Could not remove the donation.')
  }

  const total = donations.reduce((sum, d) => sum + d.amount, 0)

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Offline &amp; imported donations</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Record gifts made outside the platform — e.g. migrating existing donors from ShoutForGood — so
          the fundraiser total carries over. These count towards the progress bar and appear on the donor list.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form ref={formRef} onSubmit={handleAdd} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Input label="Business / donor name" name="donorName" placeholder="e.g. JCK Construction (blank = Anonymous)" />
          <Input label="Amount (AUD)" name="amount" type="number" min="0.01" step="0.01" required />
          <Input label="Date" name="donatedAt" type="date" hint="Defaults to today" />
          <Button type="submit" disabled={loading} className="mb-1">
            <Plus className="h-4 w-4" /> {loading ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <Input label="Message (optional)" name="message" placeholder="e.g. Great cause, well done JCK team!" />
      </form>

      {donations.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5">Donor</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) =>
                editingId === d.id ? (
                  <tr key={d.id} className="border-b border-gray-100 bg-orange-50/40 last:border-0">
                    <td className="px-4 py-2.5" colSpan={4}>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                        <Input
                          label="Donor name"
                          value={draft.donorName}
                          onChange={(e) => setDraft((p) => ({ ...p, donorName: e.target.value }))}
                          placeholder="Anonymous"
                        />
                        <Input
                          label="Amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.amount}
                          onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))}
                        />
                        <Input
                          label="Date"
                          type="date"
                          value={draft.donatedAt}
                          onChange={(e) => setDraft((p) => ({ ...p, donatedAt: e.target.value }))}
                        />
                        <div className="mb-1 flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleSave(d.id)}
                            disabled={savingId === d.id}
                            className="inline-flex h-10 items-center gap-1 rounded-md bg-orange-500 px-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" /> {savingId === d.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                            aria-label="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="sm:col-span-4">
                          <Input
                            label="Message (optional)"
                            value={draft.message}
                            onChange={(e) => setDraft((p) => ({ ...p, message: e.target.value }))}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="text-gray-900">{d.donorName || 'Anonymous'}</span>
                      {d.message && <p className="mt-0.5 text-xs text-gray-400">“{d.message}”</p>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{d.date}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">{aud.format(d.amount)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(d)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-orange-600"
                          aria-label="Edit donation"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove donation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 font-semibold text-gray-700" colSpan={2}>
                  {donations.length} offline {donations.length === 1 ? 'gift' : 'gifts'}
                </td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900">{aud.format(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
