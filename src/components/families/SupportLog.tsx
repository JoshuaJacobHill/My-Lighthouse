'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { recordSupportAction, removeSupportAction } from '@/lib/actions/households.actions'
import { SUPPORT_KINDS, daysSince, recentlyGiven, supportLabel } from '@/lib/households-core'

/**
 * What this household has received, and recording the next thing.
 *
 * The prompt above the button is the point: "last free trolley 9 days ago"
 * shown *while* somebody is deciding, rather than a report they could have run
 * afterwards. It never blocks — whether to give a second trolley this
 * fortnight is a judgement for a person who can see the family, and the app's
 * job is only to make sure that judgement is made with the fact in hand.
 */
const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'

export type SupportRow = {
  id: string
  kind: string
  givenAt: string
  quantity: number
  notes: string | null
  organisation: string | null
}

export function SupportLog({
  householdId,
  rows,
  lastByKind,
}: {
  householdId: string
  rows: SupportRow[]
  /** Kind → ISO date of the last one, for the prompt. */
  lastByKind: Record<string, string>
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<string>('FREE_TROLLEY')
  const [givenAt, setGivenAt] = useState(new Date().toISOString().slice(0, 10))
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const lastOfKind = lastByKind[kind] ? new Date(lastByKind[kind]) : null
  const since = daysSince(lastOfKind)

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('householdId', householdId)
      fd.set('kind', kind)
      fd.set('givenAt', givenAt)
      fd.set('quantity', quantity)
      fd.set('notes', notes)

      const result = await recordSupportAction(fd)
      if (result.success) {
        setAdding(false)
        setNotes('')
        setQuantity('1')
        router.refresh()
      } else {
        setError(result.error ?? 'Could not record that.')
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', id)
      await removeSupportAction(fd)
      router.refresh()
    })
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">What they&rsquo;ve received</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-neutral-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Record something
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 rounded-[28px] border border-neutral-200 p-5">
          <div className="grid gap-4">
            <div>
              <label className="block text-[13px] font-bold" htmlFor="kind">
                What was given?
              </label>
              <select
                id="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={`${field} mt-1.5`}
              >
                {SUPPORT_KINDS.map(([value, name, hint]) => (
                  <option key={value} value={value}>
                    {name} — {hint}
                  </option>
                ))}
              </select>

              {/* The fact, while the decision is being made. */}
              {since !== null && (
                <p
                  className={`mt-2 text-[13px] ${
                    recentlyGiven(since) ? 'font-semibold text-amber-700' : 'text-neutral-500'
                  }`}
                >
                  Last {supportLabel(kind).toLowerCase()}:{' '}
                  {since === 0 ? 'today' : since === 1 ? 'yesterday' : `${since} days ago`}.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[13px] font-bold" htmlFor="givenAt">
                  When
                </label>
                <input
                  id="givenAt"
                  type="date"
                  value={givenAt}
                  onChange={(e) => setGivenAt(e.target.value)}
                  className={`${field} mt-1.5`}
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold" htmlFor="quantity">
                  How many
                </label>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`${field} mt-1.5`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold" htmlFor="supportNotes">
                Notes
              </label>
              <input
                id="supportNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${field} mt-1.5`}
                placeholder="Anything worth remembering about this one"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Record it'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setError(null)
                }}
                className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-50"
              >
                Cancel
              </button>
              {error && (
                <span role="alert" className="text-[13px] font-semibold text-[#c8102e]">
                  {error}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Nothing recorded yet.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {supportLabel(row.kind)}
                  {row.quantity > 1 ? ` × ${row.quantity}` : ''}
                </span>
                <span className="block text-[13px] text-neutral-400">
                  {new Date(row.givenAt).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'Australia/Brisbane',
                  })}
                  {row.organisation ? ` · via ${row.organisation}` : ''}
                  {row.notes ? ` · ${row.notes}` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(row.id)}
                disabled={pending}
                aria-label="Remove this entry"
                title="Remove — for a mistyped entry"
                className="shrink-0 rounded-full p-1.5 text-neutral-300 hover:bg-red-50 hover:text-[#c8102e]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
