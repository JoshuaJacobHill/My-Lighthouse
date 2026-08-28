'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { HandHeart, Briefcase, Church, Heart, Loader2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createUserAction } from '@/lib/actions/admin.actions'
import { LOCATIONS, AUSTRALIAN_STATES } from '@/lib/constants'
import type { Capability } from '@/lib/permissions-core'

const TYPES = [
  { key: 'asVolunteer', label: 'Volunteer', icon: HandHeart, hint: 'Books shifts, completes an induction', needs: 'care.people' },
  { key: 'asStaff', label: 'Staff', icon: Briefcase, hint: 'Tasks, checklists and staff-only updates', needs: 'care.people' },
  { key: 'asChurchMember', label: 'Church member', icon: Church, hint: 'Sees church-only news, events and teams', needs: 'church.members' },
  { key: 'asDonor', label: 'Donor', icon: Heart, hint: 'Creates their giving record for receipts', needs: 'care.giving' },
] as const

type TypeKey = (typeof TYPES)[number]['key']

export function NewUserForm({ capabilities }: { capabilities: Capability[] }) {
  const router = useRouter()
  const [types, setTypes] = React.useState<Record<TypeKey, boolean>>({
    asVolunteer: false,
    asStaff: false,
    asChurchMember: false,
    asDonor: false,
  })
  const [locations, setLocations] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [sendInvite, setSendInvite] = React.useState(true)
  const isVolunteer = types.asVolunteer
  const isDonor = types.asDonor
  const noneChosen = !Object.values(types).some(Boolean)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const res = await createUserAction({
      firstName: String(fd.get('firstName') ?? ''),
      lastName: String(fd.get('lastName') ?? ''),
      email: String(fd.get('email') ?? ''),
      mobile: String(fd.get('mobile') ?? ''),
      dateOfBirth: String(fd.get('dateOfBirth') ?? '') || undefined,
      addressLine1: String(fd.get('addressLine1') ?? '') || undefined,
      addressLine2: String(fd.get('addressLine2') ?? '') || undefined,
      suburb: String(fd.get('suburb') ?? '') || undefined,
      state: String(fd.get('state') ?? '') || undefined,
      postcode: String(fd.get('postcode') ?? '') || undefined,
      emergencyName: String(fd.get('emergencyName') ?? '') || undefined,
      emergencyPhone: String(fd.get('emergencyPhone') ?? '') || undefined,
      emergencyRelation: String(fd.get('emergencyRelation') ?? '') || undefined,
      status: String(fd.get('status') ?? '') || undefined,
      notes: String(fd.get('notes') ?? '') || undefined,
      preferredLocations: locations,
      sendInvite,
      ...types,
    })
    setLoading(false)
    if (!res.success) return setError(res.error ?? 'Could not create the user.')
    // The account exists either way, so a failed invite is a warning on the
    // next screen rather than a reason to keep them on the form.
    const query = res.emailError ? '?invite=failed' : sendInvite ? '?invite=sent' : ''
    router.push(res.userId ? `/admin/users/${res.userId}${query}` : '/admin/users')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Who are they? */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">What kind of user is this?</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Pick any that apply — people are often more than one.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TYPES.filter((t) => capabilities.includes(t.needs as Capability)).map((t) => {
            const Icon = t.icon
            const on = types[t.key]
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => setTypes((p) => ({ ...p, [t.key]: !p[t.key] }))}
                className={
                  'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ' +
                  (on ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300')
                }
              >
                <Icon className={'mt-0.5 h-5 w-5 shrink-0 ' + (on ? 'text-orange-600' : 'text-gray-400')} />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{t.label}</span>
                  <span className="block text-xs text-gray-500">{t.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
        {noneChosen && (
          <p className="mt-3 text-xs text-gray-500">
            With none selected you&rsquo;ll create a basic supporter account — they can still sign in and see news and events.
          </p>
        )}
        {isDonor && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Donor records exist for receipting. They&rsquo;ll only appear under the <strong>Donors</strong> tab once a
            gift is recorded against them.
          </p>
        )}
      </section>

      {/* Basics */}
      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="First Name" name="firstName" required autoComplete="given-name" />
          <Input label="Last Name" name="lastName" required autoComplete="family-name" />
          <Input label="Email Address" name="email" type="email" required autoComplete="email" />
          <Input
            label={isVolunteer ? 'Mobile Number' : 'Mobile Number (optional)'}
            name="mobile"
            type="tel"
            required={isVolunteer}
            autoComplete="tel"
            hint="e.g. 0412 345 678"
          />
        </div>
      </section>

      {/* Volunteer-only */}
      {isVolunteer && (
        <>
          <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Volunteer details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Date of Birth" name="dateOfBirth" type="date" />
              <div className="flex flex-col gap-1">
                <label htmlFor="status" className="text-sm font-medium text-gray-700">Status</label>
                <select
                  id="status"
                  name="status"
                  defaultValue="PENDING_INDUCTION"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="PENDING_INDUCTION">Pending induction</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ON_LEAVE">On leave</option>
                </select>
              </div>
              <Input label="Emergency Contact Name" name="emergencyName" />
              <Input label="Emergency Contact Phone" name="emergencyPhone" type="tel" />
              <Input label="Relationship" name="emergencyRelation" placeholder="e.g. Partner" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Preferred locations</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {LOCATIONS.map((loc) => {
                  const on = locations.includes(loc)
                  return (
                    <button
                      key={loc}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setLocations((p) => (on ? p.filter((x) => x !== loc) : [...p, loc]))
                      }
                      className={
                        'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ' +
                        (on ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 text-gray-600 hover:border-orange-400')
                      }
                    >
                      {loc}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Address</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Address Line 1" name="addressLine1" className="sm:col-span-2" autoComplete="address-line1" />
              <Input label="Address Line 2" name="addressLine2" className="sm:col-span-2" autoComplete="address-line2" />
              <Input label="Suburb" name="suburb" autoComplete="address-level2" />
              <div className="flex flex-col gap-1">
                <label htmlFor="state" className="text-sm font-medium text-gray-700">State</label>
                <select
                  id="state"
                  name="state"
                  defaultValue="QLD"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {AUSTRALIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Input label="Postcode" name="postcode" autoComplete="postal-code" maxLength={4} />
            </div>
            <Input label="Notes" name="notes" placeholder="Anything the team should know (optional)" />
          </section>
        </>
      )}

      <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(e) => setSendInvite(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <span>
          <span className="block text-sm font-medium text-gray-800">Email them a link to set a password</span>
          <span className="block text-xs text-gray-500">
            Without this they&rsquo;ll have an account but no way to sign in. Turn it off only if you&rsquo;re adding
            someone in advance and will invite them later.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : 'Create user'}
        </Button>
        <button
          type="button"
          onClick={() => router.push('/admin/users')}
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
