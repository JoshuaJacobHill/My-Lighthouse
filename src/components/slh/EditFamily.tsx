'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Plus, X } from 'lucide-react'
import {
  removeChildAction,
  saveChildAction,
  updateFamilyAction,
} from '@/lib/actions/slh.actions'
import { FamilyLink } from '@/components/slh/FamilyLink'

/**
 * Editing a nominated family.
 *
 * Guardian details, the nomination reason, the children, and the link that
 * lets the family fill the wish lists in themselves — the four things an
 * organisation comes back to a record for.
 */
const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'
const label = 'block text-[13px] font-bold'

type ChildRow = {
  id: string
  firstName: string
  dateOfBirth: string
  gender: string
  hasShopper: boolean
  filled: boolean
}

export function EditFamily({
  organisationId,
  family,
  childRows,
}: {
  organisationId: string
  family: {
    id: string
    guardianName: string
    guardianEmail: string
    guardianPhone: string
    notes: string
    shareToken: string | null
    shareOpenedAt: string | null
  }
  childRows: ChildRow[]
}) {
  const router = useRouter()
  const [v, setV] = useState({
    guardianName: family.guardianName,
    guardianEmail: family.guardianEmail,
    guardianPhone: family.guardianPhone,
    notes: family.notes,
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ firstName: '', dateOfBirth: '', gender: '' })
  const [pending, startTransition] = useTransition()

  function saveFamily() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('familyId', family.id)
      for (const [key, value] of Object.entries(v)) fd.set(key, value)
      const result = await updateFamilyAction(fd)
      if (result.success) {
        setSaved(true)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save that.')
      }
    })
  }

  function saveChild(child: Partial<ChildRow> & { id?: string }) {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('familyId', family.id)
      if (child.id) fd.set('childId', child.id)
      fd.set('firstName', child.firstName ?? '')
      fd.set('dateOfBirth', child.dateOfBirth ?? '')
      fd.set('gender', child.gender ?? '')
      const result = await saveChildAction(fd)
      if (result.success) {
        setAdding(false)
        setDraft({ firstName: '', dateOfBirth: '', gender: '' })
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save that child.')
      }
    })
  }

  return (
    <>
      <div className="mt-7 grid gap-5">
        <div>
          <label className={label} htmlFor="guardianName">
            Parent or guardian
          </label>
          <input
            id="guardianName"
            value={v.guardianName}
            onChange={(e) => {
              setV({ ...v, guardianName: e.target.value })
              setSaved(false)
            }}
            className={`${field} mt-1.5`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="guardianPhone">
              Phone
            </label>
            <input
              id="guardianPhone"
              inputMode="tel"
              value={v.guardianPhone}
              onChange={(e) => {
                setV({ ...v, guardianPhone: e.target.value })
                setSaved(false)
              }}
              className={`${field} mt-1.5`}
              placeholder="Mobile number"
            />
          </div>
          <div>
            <label className={label} htmlFor="guardianEmail">
              Email
            </label>
            <input
              id="guardianEmail"
              inputMode="email"
              value={v.guardianEmail}
              onChange={(e) => {
                setV({ ...v, guardianEmail: e.target.value })
                setSaved(false)
              }}
              className={`${field} mt-1.5`}
              placeholder="Email address"
            />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="notes">
            Why they were nominated
          </label>
          <span className="mt-1 inline-block rounded-full bg-[#fdecef] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#c8102e]">
            Your team and Lighthouse only — never the shopper
          </span>
          <textarea
            id="notes"
            rows={3}
            value={v.notes}
            onChange={(e) => {
              setV({ ...v, notes: e.target.value })
              setSaved(false)
            }}
            className={`${field} mt-2 resize-y`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveFamily}
            disabled={pending}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-[13px] font-semibold text-green-700">Saved.</span>}
          {error && (
            <span role="alert" className="text-[13px] font-semibold text-[#c8102e]">
              {error}
            </span>
          )}
        </div>
      </div>

      <hr className="my-8 border-neutral-100" />

      <h2 className="text-lg font-bold tracking-tight">
        Their children <span className="font-normal text-neutral-400">{childRows.length}</span>
      </h2>

      <div className="mt-3 grid gap-3">
        {childRows.map((child) => (
          <ChildEditor
            key={child.id}
            child={child}
            organisationId={organisationId}
            busy={pending}
            onSave={saveChild}
            onRemove={() => {
              if (!window.confirm(`Remove ${child.firstName} from this nomination?`)) return
              startTransition(async () => {
                const fd = new FormData()
                fd.set('childId', child.id)
                const result = await removeChildAction(fd)
                if (!result.success) setError(result.error ?? 'Could not remove that child.')
                router.refresh()
              })
            }}
          />
        ))}
      </div>

      {adding ? (
        <div className="mt-3 rounded-[28px] border border-neutral-200 p-5">
          <div className="grid gap-4">
            <input
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              placeholder="First name"
              aria-label="First name"
              className={field}
            />
            <input
              type="date"
              value={draft.dateOfBirth}
              onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
              aria-label="Date of birth"
              className={field}
            />
            <div className="flex gap-2">
              {(['girl', 'boy'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setDraft({ ...draft, gender: g })}
                  aria-pressed={draft.gender === g}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    draft.gender === g
                      ? 'bg-neutral-900 text-white'
                      : 'border border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {g === 'girl' ? 'A girl' : 'A boy'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveChild(draft)}
                disabled={pending}
                className="rounded-full bg-[#c8102e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9d0b23] disabled:opacity-50"
              >
                Add them
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-2 text-[13px] font-bold hover:bg-neutral-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add another child
        </button>
      )}

      <hr className="my-8 border-neutral-100" />

      <h2 className="text-lg font-bold tracking-tight">Let them fill it in themselves</h2>
      <p className="mt-1 text-sm text-neutral-500">
        One link for the whole family. They write each child&rsquo;s list on their phone — no
        account, no password — and it comes straight back here.
      </p>
      <FamilyLink
        familyId={family.id}
        token={family.shareToken}
        openedAt={family.shareOpenedAt}
      />
    </>
  )
}

function ChildEditor({
  child,
  organisationId,
  busy,
  onSave,
  onRemove,
}: {
  child: ChildRow
  organisationId: string
  busy: boolean
  onSave: (child: Partial<ChildRow> & { id: string }) => void
  onRemove: () => void
}) {
  const [v, setV] = useState({
    firstName: child.firstName,
    dateOfBirth: child.dateOfBirth,
    gender: child.gender,
  })
  const dirty =
    v.firstName !== child.firstName ||
    v.dateOfBirth !== child.dateOfBirth ||
    v.gender !== child.gender

  return (
    <div className="rounded-[28px] border border-neutral-200 p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={v.firstName}
          onChange={(e) => setV({ ...v, firstName: e.target.value })}
          aria-label="First name"
          className={field}
        />
        <input
          type="date"
          value={v.dateOfBirth}
          onChange={(e) => setV({ ...v, dateOfBirth: e.target.value })}
          aria-label="Date of birth"
          className={field}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(['girl', 'boy'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setV({ ...v, gender: g })}
            aria-pressed={v.gender === g}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${
              v.gender === g
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {g === 'girl' ? 'A girl' : 'A boy'}
          </button>
        ))}

        <span className="ml-auto flex flex-wrap items-center gap-3">
          {child.filled && (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-green-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> List filled in
            </span>
          )}
          <Link
            href={`/dashboard/slh/org/${organisationId}/child/${child.id}`}
            className="text-[13px] font-semibold underline underline-offset-2"
          >
            Their wish list
          </Link>
          {dirty && (
            <button
              type="button"
              onClick={() => onSave({ ...v, id: child.id })}
              disabled={busy}
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-[13px] font-bold text-white hover:bg-neutral-700"
            >
              Save
            </button>
          )}
          {!child.hasShopper && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              aria-label={`Remove ${child.firstName}`}
              className="rounded-full p-1.5 text-neutral-300 hover:bg-red-50 hover:text-[#c8102e]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
