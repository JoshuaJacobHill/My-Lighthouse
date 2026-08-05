'use client'

import * as React from 'react'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { CheckCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { registerVolunteerAction } from '@/lib/actions/auth.actions'
import {
  LOCATIONS,
  DAYS_OF_WEEK,
  AUSTRALIAN_STATES,
} from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  // Step 1
  firstName: string
  lastName: string
  email: string
  mobile: string
  dateOfBirth: string
  addressLine1: string
  addressLine2: string
  suburb: string
  state: string
  postcode: string
  preferredStore: string
  // Step 2
  emergencyName: string
  emergencyPhone: string
  emergencyRelation: string
  medicalNotes: string
  accessibilityNeeds: string
  blueCardStatus: string
  blueCardNumber: string
  blueCardExpiry: string
  // Step 3
  firstVisitDate: string
  firstVisitPeriod: string
  availability: { day: string; startTime: string; endTime: string }[]
  notes: string
  // Account
  password: string
  confirmPassword: string
  // Step 4
  agreedToTerms: boolean
  agreedToPrivacy: boolean
  consentEmailUpdates: boolean
  consentSmsUpdates: boolean
  agreedToInduction: boolean
}

const INITIAL_FORM: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  dateOfBirth: '',
  addressLine1: '',
  addressLine2: '',
  suburb: '',
  state: 'QLD',
  postcode: '',
  preferredStore: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  medicalNotes: '',
  accessibilityNeeds: '',
  blueCardStatus: 'Not Applicable',
  blueCardNumber: '',
  blueCardExpiry: '',
  firstVisitDate: '',
  firstVisitPeriod: '09:00',
  availability: [],
  notes: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
  agreedToPrivacy: false,
  consentEmailUpdates: false,
  consentSmsUpdates: false,
  agreedToInduction: false,
}

// Fields we can pre-fill for a signed-in donor signing up to volunteer.
export type SignupPrefill = Partial<
  Pick<FormData, 'firstName' | 'lastName' | 'email' | 'mobile' | 'addressLine1'>
>

const STEP_TITLES = [
  'Personal Details',
  'Emergency & Health',
  'Availability & Notes',
  'Agreements & Account',
]

const BLUE_CARD_OPTIONS = ['Not Applicable', 'Pending', 'Current', 'Expired']

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format "HH:MM" → "9:00 am" for display */
function formatTimeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

// ─── Subform components ───────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  errors,
}: {
  data: FormData
  onChange: (patch: Partial<FormData>) => void
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="First name *"
          value={data.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })}
          placeholder="Jane"
          error={errors.firstName}
          autoComplete="given-name"
        />
        <Input
          label="Last name *"
          value={data.lastName}
          onChange={(e) => onChange({ lastName: e.target.value })}
          placeholder="Smith"
          error={errors.lastName}
          autoComplete="family-name"
        />
      </div>
      <Input
        label="Email address *"
        type="email"
        value={data.email}
        onChange={(e) => onChange({ email: e.target.value })}
        placeholder="jane@example.com"
        error={errors.email}
        autoComplete="email"
      />
      <Input
        label="Phone number *"
        type="tel"
        value={data.mobile}
        onChange={(e) => onChange({ mobile: e.target.value })}
        placeholder="04XX XXX XXX or 07 xxxx xxxx"
        hint="Australian mobile or landline (e.g. 0412 345 678 or 07 3123 4567)"
        error={errors.mobile}
        autoComplete="tel"
      />
      <Input
        label="Date of birth"
        type="date"
        value={data.dateOfBirth}
        onChange={(e) => onChange({ dateOfBirth: e.target.value })}
        error={errors.dateOfBirth}
        autoComplete="bday"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Which store would you prefer to volunteer at? *
        </label>
        <select
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          value={data.preferredStore}
          onChange={(e) => onChange({ preferredStore: e.target.value })}
          required
        >
          <option value="">Select a store…</option>
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        {errors.preferredStore && (
          <p className="mt-1 text-xs text-red-600">{errors.preferredStore}</p>
        )}
      </div>

      <hr className="border-gray-200" />
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Home address (optional)</h3>
      <Input
        label="Address line 1"
        value={data.addressLine1}
        onChange={(e) => onChange({ addressLine1: e.target.value })}
        placeholder="123 Example Street"
        autoComplete="address-line1"
      />
      <Input
        label="Address line 2"
        value={data.addressLine2}
        onChange={(e) => onChange({ addressLine2: e.target.value })}
        placeholder="Unit 4"
        autoComplete="address-line2"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Input
            label="Suburb"
            value={data.suburb}
            onChange={(e) => onChange({ suburb: e.target.value })}
            placeholder="Loganholme"
            autoComplete="address-level2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <select
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value })}
            autoComplete="address-level1"
          >
            {AUSTRALIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Input
            label="Postcode"
            value={data.postcode}
            onChange={(e) => onChange({ postcode: e.target.value })}
            placeholder="4129"
            maxLength={4}
            error={errors.postcode}
            autoComplete="postal-code"
          />
        </div>
      </div>
    </div>
  )
}

function Step2({
  data,
  onChange,
  errors,
}: {
  data: FormData
  onChange: (patch: Partial<FormData>) => void
  errors: Record<string, string>
}) {
  const showBlueCardFields = data.blueCardStatus === 'Current'

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Emergency contact</h3>
      <Input
        label="Contact name *"
        value={data.emergencyName}
        onChange={(e) => onChange({ emergencyName: e.target.value })}
        placeholder="John Smith"
        error={errors.emergencyName}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Contact phone *"
          type="tel"
          value={data.emergencyPhone}
          onChange={(e) => onChange({ emergencyPhone: e.target.value })}
          placeholder="04XX XXX XXX"
          error={errors.emergencyPhone}
        />
        <Input
          label="Relationship to you"
          value={data.emergencyRelation}
          onChange={(e) => onChange({ emergencyRelation: e.target.value })}
          placeholder="e.g. Spouse, Parent, Friend"
        />
      </div>

      <hr className="border-gray-200" />
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Health & accessibility</h3>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Medical notes (optional)</label>
        <textarea
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
          rows={3}
          placeholder="Any medical conditions or medications we should be aware of in an emergency..."
          value={data.medicalNotes}
          onChange={(e) => onChange({ medicalNotes: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Accessibility needs (optional)</label>
        <textarea
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
          rows={3}
          placeholder="Any accessibility requirements or accommodations we can help with..."
          value={data.accessibilityNeeds}
          onChange={(e) => onChange({ accessibilityNeeds: e.target.value })}
        />
      </div>

      <hr className="border-gray-200" />
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Blue Card (Working with Children)</h3>
      <p className="text-sm text-gray-600">
        Some volunteer roles require a current Blue Card. Please let us know your status.
      </p>
      <div className="flex flex-col gap-2">
        {BLUE_CARD_OPTIONS.map((option) => (
          <label key={option} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="blueCardStatus"
              value={option}
              checked={data.blueCardStatus === option}
              onChange={() => onChange({ blueCardStatus: option })}
              className="h-4 w-4 text-orange-500 border-gray-300 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">{option}</span>
          </label>
        ))}
      </div>
      {showBlueCardFields && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2 pl-4 border-l-2 border-orange-200">
          <Input
            label="Blue Card number"
            value={data.blueCardNumber}
            onChange={(e) => onChange({ blueCardNumber: e.target.value })}
            placeholder="e.g. 1234567/1"
          />
          <Input
            label="Expiry date"
            type="date"
            value={data.blueCardExpiry}
            onChange={(e) => onChange({ blueCardExpiry: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

function Step3({
  data,
  onChange,
  errors,
}: {
  data: FormData
  onChange: (patch: Partial<FormData>) => void
  errors: Record<string, string>
}) {
  // ── Time range availability helpers ──────────────────────────────────────────
  const DAYS_FULL = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ]
  const TIME_OPTIONS: string[] = []
  for (let h = 6; h <= 20; h++) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
  }
  TIME_OPTIONS.push('20:30')

  function toMins(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  function getRangesForDay(day: string) {
    return data.availability.filter((a) => a.day === day)
  }

  function removeRange(day: string, startTime: string) {
    onChange({ availability: data.availability.filter((a) => !(a.day === day && a.startTime === startTime)) })
  }

  function addRange(day: string, startTime: string, endTime: string) {
    const updated = [
      ...data.availability,
      { day, startTime, endTime },
    ].sort((a, b) => {
      if (a.day !== b.day) return DAYS_FULL.indexOf(a.day) - DAYS_FULL.indexOf(b.day)
      return toMins(a.startTime) - toMins(b.startTime)
    })
    onChange({ availability: updated })
  }

  // Calculate tomorrow and max date (60 days from now) for the date picker
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + 60)
  const toInputDate = (d: Date) => d.toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      {/* First visit section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
          Your first visit
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          When would you like to come in for your first visit? Our volunteer coordinator will meet with you to get you settled in.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              min={toInputDate(tomorrow)}
              max={toInputDate(maxDate)}
              value={data.firstVisitDate}
              onChange={(e) => onChange({ firstVisitDate: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {errors.firstVisitDate && (
              <p className="mt-1 text-xs text-red-600" role="alert">{errors.firstVisitDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred arrival time *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Our coordinator is available Mon–Sat, 9 am – 5 pm. Choose a time that suits you.
            </p>
            <input
              type="time"
              min="09:00"
              max="17:00"
              value={data.firstVisitPeriod}
              onChange={(e) => onChange({ firstVisitPeriod: e.target.value })}
              className="block rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {errors.firstVisitPeriod && (
              <p className="mt-1 text-xs text-red-600" role="alert">{errors.firstVisitPeriod}</p>
            )}
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Trading hours info box */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
        <p className="font-semibold mb-1">Our trading hours:</p>
        <ul className="space-y-0.5 list-none">
          <li>Loganholme Store: Mon–Fri 9am–5pm, Sat 9am–4pm</li>
          <li>Hillcrest Store: Mon–Fri 9am–5pm, Sat 9am–12pm</li>
          <li>We are closed Sundays</li>
        </ul>
      </div>

      {/* Availability time ranges */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
          General availability
        </h3>
        <p className="text-sm text-gray-600 mb-1">
          Add the times you&apos;re generally available each week. Even a 30-minute slot helps — add as many ranges as you like.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          You can update this any time from your volunteer dashboard.
        </p>

        <div className="space-y-1 divide-y divide-gray-100">
          {DAYS_FULL.map((day) => (
            <DayAvailabilityRow
              key={day}
              day={day}
              ranges={getRangesForDay(day)}
              timeOptions={TIME_OPTIONS}
              onAdd={addRange}
              onRemove={removeRange}
            />
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Other notes (optional)</label>
        <textarea
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
          rows={3}
          placeholder="Anything else you'd like us to know..."
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  )
}

// ─── Inline day availability row for signup form ──────────────────────────────

function DayAvailabilityRow({
  day,
  ranges,
  timeOptions,
  onAdd,
  onRemove,
}: {
  day: string
  ranges: { day: string; startTime: string; endTime: string }[]
  timeOptions: string[]
  onAdd: (day: string, start: string, end: string) => void
  onRemove: (day: string, start: string) => void
}) {
  const [adding, setAdding] = React.useState(false)
  const [start, setStart] = React.useState('09:00')
  const [end, setEnd] = React.useState('12:00')
  const [err, setErr] = React.useState('')

  function toMins(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const endOptions = timeOptions.filter((t) => toMins(t) >= toMins(start) + 30)

  React.useEffect(() => {
    if (toMins(end) < toMins(start) + 30) {
      const valid = endOptions[0]
      if (valid) setEnd(valid)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start])

  function handleAdd() {
    setErr('')
    if (toMins(end) - toMins(start) < 30) { setErr('Minimum 30 minutes.'); return }
    const overlap = ranges.some((r) => toMins(start) < toMins(r.endTime) && toMins(end) > toMins(r.startTime))
    if (overlap) { setErr('Overlaps with an existing range.'); return }
    onAdd(day, start, end)
    setAdding(false)
    setStart('09:00')
    setEnd('12:00')
  }

  return (
    <div className="py-2.5 flex items-start gap-3">
      <span className="w-24 shrink-0 pt-1 text-sm font-medium text-gray-700">{day}</span>
      <div className="flex-1 flex flex-wrap items-center gap-2">
        {ranges.map((r) => (
          <span key={r.startTime} className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 px-2.5 py-1 text-xs font-medium">
            {formatTimeLabel(r.startTime)} – {formatTimeLabel(r.endTime)}
            <button type="button" onClick={() => onRemove(day, r.startTime)} className="ml-0.5 text-orange-500 hover:text-red-600 transition-colors" aria-label="Remove">×</button>
          </span>
        ))}

        {adding ? (
          <div className="flex flex-wrap items-end gap-2 mt-1">
            <select value={start} onChange={(e) => setStart(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm bg-white focus:border-orange-500 focus:outline-none">
              {timeOptions.filter((t) => t < '20:00').map((t) => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
            </select>
            <span className="text-gray-400 text-sm">→</span>
            <select value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm bg-white focus:border-orange-500 focus:outline-none">
              {endOptions.map((t) => <option key={t} value={t}>{formatTimeLabel(t)}</option>)}
            </select>
            <button type="button" onClick={handleAdd} className="rounded bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600 transition-colors">Add</button>
            <button type="button" onClick={() => { setAdding(false); setErr('') }} className="rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            {err && <p className="w-full text-xs text-red-600">{err}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-orange-500 hover:text-orange-700 font-medium transition-colors"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  )
}

function Step4({
  data,
  onChange,
  errors,
}: {
  data: FormData
  onChange: (patch: Partial<FormData>) => void
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Create your account password
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Password *"
            type="password"
            value={data.password}
            onChange={(e) => onChange({ password: e.target.value })}
            hint="Minimum 8 characters"
            error={errors.password}
            autoComplete="new-password"
          />
          <Input
            label="Confirm password *"
            type="password"
            value={data.confirmPassword}
            onChange={(e) => onChange({ confirmPassword: e.target.value })}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
        </div>
      </div>

      <hr className="border-gray-200" />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Communications (optional)
        </h3>
        <div className="space-y-3">
          <Checkbox
            label="I'm happy to receive volunteer updates and news by email"
            checked={data.consentEmailUpdates}
            onCheckedChange={(checked) => onChange({ consentEmailUpdates: !!checked })}
          />
          <Checkbox
            label="I'm happy to receive shift reminders and urgent updates by SMS"
            checked={data.consentSmsUpdates}
            onCheckedChange={(checked) => onChange({ consentSmsUpdates: !!checked })}
          />
        </div>
      </div>

      <hr className="border-gray-200" />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Required agreements
        </h3>
        <div className="space-y-4">
          {/* Terms agreement — uses plain checkbox + label to support JSX link */}
          <div className="flex items-start gap-3">
            <input
              id="agreedToTerms"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
              checked={data.agreedToTerms}
              onChange={(e) => onChange({ agreedToTerms: e.target.checked })}
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="agreedToTerms" className="text-sm font-medium text-gray-700 cursor-pointer">
                I have read and agree to the{' '}
                <Link href="/terms" target="_blank" className="text-orange-500 underline hover:text-orange-600">
                  Volunteer Terms &amp; Conditions
                </Link>{' '}
                *
              </label>
              {errors.agreedToTerms && (
                <p className="text-xs text-red-600" role="alert">{errors.agreedToTerms}</p>
              )}
            </div>
          </div>

          {/* Privacy agreement */}
          <div className="flex items-start gap-3">
            <input
              id="agreedToPrivacy"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
              checked={data.agreedToPrivacy}
              onChange={(e) => onChange({ agreedToPrivacy: e.target.checked })}
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="agreedToPrivacy" className="text-sm font-medium text-gray-700 cursor-pointer">
                I have read and agree to the{' '}
                <Link href="/privacy" target="_blank" className="text-orange-500 underline hover:text-orange-600">
                  Privacy Policy
                </Link>{' '}
                *
              </label>
              {errors.agreedToPrivacy && (
                <p className="text-xs text-red-600" role="alert">{errors.agreedToPrivacy}</p>
              )}
            </div>
          </div>

          <Checkbox
            label="I understand that I will need to complete an online induction before my first shift *"
            checked={data.agreedToInduction}
            onCheckedChange={(checked) => onChange({ agreedToInduction: !!checked })}
            error={errors.agreedToInduction}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SignupClient({ prefill }: { prefill?: SignupPrefill }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({ ...INITIAL_FORM, ...prefill })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)

  const totalSteps = 4

  function patch(update: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...update }))
  }

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {}

    if (s === 1) {
      if (!formData.firstName.trim()) errs.firstName = 'First name is required'
      if (!formData.lastName.trim()) errs.lastName = 'Last name is required'
      if (!formData.email.trim()) errs.email = 'Email address is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Please enter a valid email address'
      if (!formData.mobile.trim()) errs.mobile = 'Phone number is required'
      else if (!/^(\+61|0)[234578]\d{8}$/.test(formData.mobile.replace(/\s/g, '')))
        errs.mobile = 'Please enter a valid Australian phone number (mobile or landline)'
      if (!formData.preferredStore) errs.preferredStore = 'Please select your preferred store'
      if (formData.postcode && !/^\d{4}$/.test(formData.postcode))
        errs.postcode = 'Postcode must be 4 digits'
    }

    if (s === 2) {
      if (!formData.emergencyName.trim()) errs.emergencyName = 'Emergency contact name is required'
      if (!formData.emergencyPhone.trim()) errs.emergencyPhone = 'Emergency contact phone is required'
    }

    if (s === 3) {
      if (!formData.firstVisitDate) errs.firstVisitDate = 'Please select your first visit date'
      if (!formData.firstVisitPeriod) {
        errs.firstVisitPeriod = 'Please enter your preferred arrival time'
      } else if (formData.firstVisitPeriod < '09:00' || formData.firstVisitPeriod > '17:00') {
        errs.firstVisitPeriod = 'Please choose a time between 9:00 am and 5:00 pm'
      }
    }

    if (s === 4) {
      if (!formData.password) errs.password = 'Password is required'
      else if (formData.password.length < 8) errs.password = 'Password must be at least 8 characters'
      if (formData.confirmPassword !== formData.password) errs.confirmPassword = 'Passwords do not match'
      if (!formData.agreedToTerms) errs.agreedToTerms = 'You must agree to the terms and conditions'
      if (!formData.agreedToPrivacy) errs.agreedToPrivacy = 'You must agree to the privacy policy'
      if (!formData.agreedToInduction) errs.agreedToInduction = 'Please acknowledge the induction requirement'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNext() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, totalSteps))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1))
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validateStep(4)) return

    setSubmitting(true)
    setGlobalError('')

    try {
      const fd = new FormData()
      fd.append('firstName', formData.firstName)
      fd.append('lastName', formData.lastName)
      fd.append('email', formData.email)
      fd.append('mobile', formData.mobile.replace(/\s/g, ''))
      if (formData.dateOfBirth) fd.append('dateOfBirth', formData.dateOfBirth)
      if (formData.addressLine1) fd.append('addressLine1', formData.addressLine1)
      if (formData.addressLine2) fd.append('addressLine2', formData.addressLine2)
      if (formData.suburb) fd.append('suburb', formData.suburb)
      if (formData.state) fd.append('state', formData.state)
      if (formData.postcode) fd.append('postcode', formData.postcode)
      if (formData.preferredStore) fd.append('preferredStore', formData.preferredStore)
      fd.append('emergencyName', formData.emergencyName)
      fd.append('emergencyPhone', formData.emergencyPhone)
      if (formData.emergencyRelation) fd.append('emergencyRelation', formData.emergencyRelation)
      if (formData.medicalNotes) fd.append('medicalNotes', formData.medicalNotes)
      if (formData.accessibilityNeeds) fd.append('accessibilityNeeds', formData.accessibilityNeeds)
      // Store preferredStore as the preferred location array for DB compatibility
      fd.append('preferredLocations', JSON.stringify(formData.preferredStore ? [formData.preferredStore] : []))
      fd.append('areasOfInterest', JSON.stringify([]))
      // Map availability to what the server action expects: dayOfWeek + timePeriod
      const mappedAvailability = formData.availability.map((a) => ({
        dayOfWeek: a.day,
        startTime: a.startTime,
        endTime: a.endTime,
      }))
      fd.append('availability', JSON.stringify(mappedAvailability))
      fd.append('firstVisitDate', formData.firstVisitDate)
      fd.append('firstVisitPeriod', formData.firstVisitPeriod)
      fd.append('password', formData.password)
      fd.append('confirmPassword', formData.confirmPassword)
      fd.append('agreedToTerms', String(formData.agreedToTerms))
      fd.append('agreedToPrivacy', String(formData.agreedToPrivacy))
      fd.append('consentEmailUpdates', String(formData.consentEmailUpdates))
      fd.append('consentSmsUpdates', String(formData.consentSmsUpdates))

      const result = await registerVolunteerAction(fd)

      if (result.success) {
        setSuccess(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        if (result.fieldErrors) {
          setErrors(result.fieldErrors)
        }
        setGlobalError(result.error ?? 'Registration failed. Please try again.')
      }
    } catch {
      setGlobalError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-16 px-4">
        <Card className="max-w-lg w-full text-center">
          <div className="p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <CheckCircle className="h-8 w-8 text-orange-500" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Thank you for signing up, {formData.firstName}!
            </h1>
            <p className="mt-4 text-gray-600 leading-relaxed">
              Please check your email for next steps. You&apos;ll need to log in and complete your
              induction before you can start volunteering.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Welcome to the Lighthouse Care volunteer family. We&apos;re so glad you&apos;re here.
            </p>
            <div className="mt-8">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Sign In to Your Account
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const progressPct = ((step - 1) / (totalSteps - 1)) * 100

  return (
    <div className="py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Become a Volunteer</h1>
          <p className="mt-2 text-gray-600">
            Join the Lighthouse Care volunteer family — it only takes a few minutes.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-orange-600">
              Step {step} of {totalSteps}: {STEP_TITLES[step - 1]}
            </span>
            <span className="text-sm text-gray-500">{Math.round(progressPct)}% complete</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progressPct === 0 ? 5 : progressPct}%` }}
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={totalSteps}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEP_TITLES.map((title, i) => (
              <span
                key={title}
                className={`text-xs font-medium ${i + 1 <= step ? 'text-orange-500' : 'text-gray-400'}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        {/* Card */}
        <Card>
          <CardHeader>
            <CardTitle>{STEP_TITLES[step - 1]}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate>
              {step === 1 && <Step1 data={formData} onChange={patch} errors={errors} />}
              {step === 2 && <Step2 data={formData} onChange={patch} errors={errors} />}
              {step === 3 && <Step3 data={formData} onChange={patch} errors={errors} />}
              {step === 4 && <Step4 data={formData} onChange={patch} errors={errors} />}

              {globalError && (
                <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">
                  {globalError}
                </div>
              )}

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between">
                <div>
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={handleBack}>
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      Back
                    </Button>
                  )}
                </div>
                <div>
                  {step < totalSteps ? (
                    <Button type="button" onClick={handleNext}>
                      Next
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Submitting...
                        </>
                      ) : (
                        'Complete Sign Up'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already registered?{' '}
          <Link href="/login" className="text-orange-500 font-medium hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
}
