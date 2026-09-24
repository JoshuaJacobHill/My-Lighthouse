'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, X } from 'lucide-react'
import { addFamilyAction } from '@/lib/actions/slh.actions'
import { EmailField } from '@/components/EmailField'

/**
 * Nominating a family.
 *
 * The guardian's details stay with the organisation and Lighthouse; a shopper
 * never sees them. They are captured because both need them — to chase a list
 * that is half filled in, and to ring a family directly when things go quiet.
 *
 * Consent is recorded rather than assumed. We will email this family, and
 * sometimes phone them, and "the organisation said it was fine" is not the
 * same as knowing when, and who said so.
 *
 * Siblings are added here rather than one at a time, because that is how a
 * caseworker thinks about a household — and because it is what makes a second
 * nomination of the same child detectable later.
 */
const field = 'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'
const label = 'block text-[13px] font-bold'

type ChildRow = {
  key: number
  firstName: string
  dateOfBirth: string
  gender: '' | 'girl' | 'boy'
  clothesSize: string
  shoesSize: string
}

const emptyChild = (key: number): ChildRow => ({
  key,
  firstName: '',
  dateOfBirth: '',
  gender: '',
  clothesSize: '',
  shoesSize: '',
})

export function AddFamilyForm({ organisationId }: { organisationId: string }) {
  const router = useRouter()
  const [noGuardian, setNoGuardian] = useState(false)
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [children, setChildren] = useState<ChildRow[]>([emptyChild(1)])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function setChild(key: number, patch: Partial<ChildRow>) {
    setChildren((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const usable = children.filter((c) => c.firstName.trim() && c.dateOfBirth && c.gender)
  const ready = usable.length > 0 && (noGuardian || (guardianName.trim() && consent))

  function submit() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('organisationId', organisationId)
      fd.set('noGuardian', String(noGuardian))
      fd.set('guardianName', guardianName)
      fd.set('guardianPhone', guardianPhone)
      fd.set('guardianEmail', guardianEmail)
      fd.set('consent', String(consent))
      fd.set(
        'children',
        JSON.stringify(
          usable.map((c) => ({
            firstName: c.firstName,
            dateOfBirth: c.dateOfBirth,
            gender: c.gender,
            clothesSize: c.clothesSize,
            shoesSize: c.shoesSize,
          })),
        ),
      )

      const result = await addFamilyAction(fd)
      if (result.success) {
        router.push(`/dashboard/slh/org/${organisationId}`)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save that family.')
      }
    })
  }

  return (
    <>
      {/* Who fills the list in, which is not quite the same question as
          whether a guardian exists. Residential and kinship care are the
          obvious cases, but so is a family the organisation would rather not
          email — a caseworker sitting down with them and writing it out is
          often kinder than a link. Expected, not an edge case. */}
      <button
        type="button"
        onClick={() => setNoGuardian(!noGuardian)}
        aria-pressed={noGuardian}
        className="mt-7 flex w-full items-start gap-3 rounded-2xl border border-neutral-200 p-4 text-left hover:bg-neutral-50"
      >
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 ${
            noGuardian ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-transparent'
          }`}
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="text-sm leading-relaxed">
          <b>Organisation is filling this list</b> — select this if the wish list is being filled
          in by your organisation, and not being sent to a parent or guardian to fill in.
        </span>
      </button>

      {!noGuardian && (
        <div className="mt-6 grid gap-5">
          <div>
            <label className={label} htmlFor="guardianName">
              Parent or guardian
            </label>
            <input
              id="guardianName"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className={`${field} mt-1.5`}
              placeholder="Parent or guardian's name"
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
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className={`${field} mt-1.5`}
                placeholder="Mobile number"
              />
            </div>
            {/* Checked as it is typed. A wrong guardian address means a
                family silently never hears from us, and nobody finds that out
                until December. */}
            <EmailField
              id="guardianEmail"
              label="Email"
              value={guardianEmail}
              onChange={setGuardianEmail}
            />
          </div>

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
              This family knows they have been nominated and is happy for Lighthouse to contact
              them
            </span>
          </button>
        </div>
      )}

      <hr className="my-7 border-neutral-100" />

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold tracking-tight">
          {noGuardian ? 'The children' : 'Their children'}
        </h2>
        <button
          type="button"
          onClick={() =>
            setChildren((rows) => [...rows, emptyChild(Math.max(...rows.map((r) => r.key)) + 1)])
          }
          className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-bold hover:bg-neutral-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add another
        </button>
      </div>

      <div className="mt-4 grid gap-7">
        {children.map((child, i) => (
          <div key={child.key} className="grid gap-4">
            {children.length > 1 && (
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-neutral-400">
                  Child {i + 1}
                </p>
                <button
                  type="button"
                  onClick={() => setChildren((rows) => rows.filter((r) => r.key !== child.key))}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-400 hover:text-[#c8102e]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                </button>
              </div>
            )}

            <div>
              <label className={label} htmlFor={`name-${child.key}`}>
                First name only
              </label>
              <input
                id={`name-${child.key}`}
                value={child.firstName}
                onChange={(e) => setChild(child.key, { firstName: e.target.value })}
                className={`${field} mt-1.5`}
                placeholder="First name"
              />
              <p className="mt-1.5 text-xs text-neutral-400">
                A shopper sees this name. Never a surname.
              </p>
            </div>

            <div>
              <label className={label} htmlFor={`dob-${child.key}`}>
                Date of birth
              </label>
              <input
                id={`dob-${child.key}`}
                type="date"
                value={child.dateOfBirth}
                onChange={(e) => setChild(child.key, { dateOfBirth: e.target.value })}
                className={`${field} mt-1.5`}
              />
              <p className="mt-1.5 text-xs text-neutral-400">
                Used to spot the same child nominated twice by two organisations. A shopper only
                ever sees an age.
              </p>
            </div>

            <div>
              <span className={label}>A boy or a girl?</span>
              <div className="mt-1.5 flex gap-2">
                {(['girl', 'boy'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setChild(child.key, { gender: g })}
                    aria-pressed={child.gender === g}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                      child.gender === g
                        ? 'bg-neutral-900 text-white'
                        : 'border border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {g === 'girl' ? 'A girl' : 'A boy'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor={`clothes-${child.key}`}>
                  Clothing size
                </label>
                <input
                  id={`clothes-${child.key}`}
                  value={child.clothesSize}
                  onChange={(e) => setChild(child.key, { clothesSize: e.target.value })}
                  className={`${field} mt-1.5`}
                  placeholder="Clothing size"
                />
              </div>
              <div>
                <label className={label} htmlFor={`shoes-${child.key}`}>
                  Shoe size
                </label>
                <input
                  id={`shoes-${child.key}`}
                  value={child.shoesSize}
                  onChange={(e) => setChild(child.key, { shoesSize: e.target.value })}
                  className={`${field} mt-1.5`}
                  placeholder="Shoe size"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="rounded-full bg-[#c8102e] py-3.5 text-base font-bold text-white hover:bg-[#9d0b23] disabled:opacity-40"
        >
          {pending
            ? 'Saving…'
            : `Save ${usable.length > 1 ? `${usable.length} children` : noGuardian ? 'this child' : 'this family'}`}
        </button>
        {error ? (
          <p role="alert" className="text-center text-[13px] font-semibold text-[#c8102e]">
            {error}
          </p>
        ) : (
          <p className="text-center text-xs text-neutral-400">
            {usable.length === 0
              ? 'Each child needs a first name, a date of birth and a boy or a girl.'
              : !ready
                ? 'Add the guardian’s name and confirm they have agreed.'
                : 'The wish list itself is filled in afterwards.'}
          </p>
        )}
      </div>
    </>
  )
}
