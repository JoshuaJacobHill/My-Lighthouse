'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check } from 'lucide-react'
import { saveHouseholdAction } from '@/lib/actions/households.actions'
import { HOUSEHOLD_STATUSES } from '@/lib/households-core'

/**
 * Adding or editing a household.
 *
 * The duplicate warning is the important part. Two records of one family is
 * the failure that makes a database like this useless within a month, and it
 * happens because somebody wrote a phone number differently. So possible
 * matches are shown *before* saving — as a prompt, never a block. People share
 * a surname and a suburb, and refusing to record a second family at one
 * address would be worse than asking.
 */
const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'
const label = 'block text-[13px] font-bold'

export type Duplicate = { id: string; name: string; suburb: string | null; why: string }

export function HouseholdForm({
  household,
  findDuplicates,
}: {
  household?: {
    id: string
    name: string
    address: string | null
    suburb: string | null
    postcode: string | null
    phone: string | null
    email: string | null
    standingNotes: string | null
    status: string
    consented: boolean
  }
  /** A server action: looks for possible matches on the way past. */
  findDuplicates: (input: {
    name?: string
    phone?: string
    email?: string
    excludeId?: string
  }) => Promise<Duplicate[]>
}) {
  const router = useRouter()
  const [v, setV] = useState({
    name: household?.name ?? '',
    address: household?.address ?? '',
    suburb: household?.suburb ?? '',
    postcode: household?.postcode ?? '',
    phone: household?.phone ?? '',
    email: household?.email ?? '',
    standingNotes: household?.standingNotes ?? '',
    status: household?.status ?? 'ACTIVE',
  })
  const [consent, setConsent] = useState(household?.consented ?? false)
  const [dupes, setDupes] = useState<Duplicate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }))

  /** Checked when a field loses focus, not on every keystroke. */
  function checkDuplicates() {
    if (!v.name.trim() && !v.phone.trim() && !v.email.trim()) return
    startTransition(async () => {
      setDupes(
        await findDuplicates({
          name: v.name,
          phone: v.phone,
          email: v.email,
          excludeId: household?.id,
        }),
      )
    })
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      if (household?.id) fd.set('id', household.id)
      for (const [key, value] of Object.entries(v)) fd.set(key, value)
      fd.set('consent', String(consent))

      const result = await saveHouseholdAction(fd)
      if (result.success && result.id) {
        router.push(`/admin/families/${result.id}`)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save that household.')
      }
    })
  }

  return (
    <div className="mt-6 grid gap-5">
      <div>
        <label className={label} htmlFor="name">
          What should we call them?
        </label>
        <input
          id="name"
          value={v.name}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={checkDuplicates}
          className={`${field} mt-1.5`}
          placeholder="Primary contact’s name, or the family name"
        />
        <p className="mt-1.5 text-xs text-neutral-400">
          However your team would say it out loud when they ring.
        </p>
      </div>

      {dupes.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {dupes.length === 1 ? 'This might already be here' : 'These might already be here'}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {dupes.map((d) => (
              <li key={d.id} className="text-sm">
                <a
                  href={`/admin/families/${d.id}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {d.name}
                </a>
                <span className="text-amber-900/70">
                  {d.suburb ? ` · ${d.suburb}` : ''} · {d.why}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-900/70">
            Open one to check. If this really is a different family, carry on — people share a
            name and a street.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            inputMode="tel"
            value={v.phone}
            onChange={(e) => set({ phone: e.target.value })}
            onBlur={checkDuplicates}
            className={`${field} mt-1.5`}
            placeholder="Mobile number"
          />
        </div>
        <div>
          <label className={label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            inputMode="email"
            value={v.email}
            onChange={(e) => set({ email: e.target.value })}
            onBlur={checkDuplicates}
            className={`${field} mt-1.5`}
            placeholder="Email address"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="address">
          Address
        </label>
        <input
          id="address"
          value={v.address}
          onChange={(e) => set({ address: e.target.value })}
          className={`${field} mt-1.5`}
          placeholder="Street address"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="suburb">
            Suburb
          </label>
          <input
            id="suburb"
            value={v.suburb}
            onChange={(e) => set({ suburb: e.target.value })}
            className={`${field} mt-1.5`}
            placeholder="Suburb"
          />
        </div>
        <div>
          <label className={label} htmlFor="postcode">
            Postcode
          </label>
          <input
            id="postcode"
            inputMode="numeric"
            value={v.postcode}
            onChange={(e) => set({ postcode: e.target.value })}
            className={`${field} mt-1.5`}
            placeholder="Postcode"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="standingNotes">
          Standing notes
        </label>
        <textarea
          id="standingNotes"
          rows={3}
          value={v.standingNotes}
          onChange={(e) => set({ standingNotes: e.target.value })}
          className={`${field} mt-1.5 resize-y`}
          placeholder="Things that are always true — access needs, an interpreter, a safe time to call"
        />
        <p className="mt-1.5 text-xs text-neutral-400">
          Not a diary. Anything dated belongs in a note on their record.
        </p>
      </div>

      {household && (
        <div>
          <label className={label} htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={v.status}
            onChange={(e) => set({ status: e.target.value })}
            className={`${field} mt-1.5`}
          >
            {HOUSEHOLD_STATUSES.map(([value, name, hint]) => (
              <option key={value} value={value}>
                {name} — {hint}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* They came to us for food, not to be catalogued. */}
      <button
        type="button"
        onClick={() => setConsent(!consent)}
        aria-pressed={consent}
        className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-left"
      >
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
            consent ? 'bg-green-600 text-white' : 'border-2 border-neutral-300 text-transparent'
          }`}
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="text-sm leading-relaxed">
          This family knows we keep a record of the support they receive, and is happy for us to
          contact them about it.
        </span>
      </button>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !v.name.trim()}
          className="rounded-full bg-neutral-900 py-3.5 text-base font-bold text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {pending ? 'Saving…' : household ? 'Save changes' : 'Add this family'}
        </button>
        {error && (
          <p role="alert" className="text-center text-[13px] font-semibold text-[#c8102e]">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
