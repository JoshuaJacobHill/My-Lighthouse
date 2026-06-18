'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  LogIn,
  LogOut,
  UserPlus,
  Search,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  kioskLookupAction,
  kioskSignInAction,
  kioskSignOutAction,
  guestSignInAction,
  kioskGetOnSiteGuestsAction,
  kioskGuestSignOutAction,
  kioskGetOnSiteVolunteersAction,
  type OnSiteGuest,
  type OnSiteVolunteer,
} from '@/lib/actions/kiosk.actions'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://volunteers.lighthousecare.org.au'
const SAFETY_INFO_URL = 'https://www.lighthousecare.org.au/volunteer-safety'

type Screen =
  | 'home'
  | 'lookup-signin'
  | 'lookup-signout'
  | 'signin-confirm'
  | 'signout-confirm'
  | 'guest-signin'

interface Location {
  id: string
  name: string
}

interface VolunteerResult {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
}

interface KioskClientProps {
  locations: Location[]
  defaultLocationId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mask an email for privacy: sarah.jones@gmail.com → s***s@gmail.com */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return '••• •••'
  // Show first 4 digits and last 2, mask the middle
  return digits.slice(0, 4) + ' ••• ' + digits.slice(-2)
}

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at) // includes @
  if (local.length <= 2) return '*'.repeat(local.length) + domain
  return local[0] + '·'.repeat(Math.min(local.length - 2, 5)) + local[local.length - 1] + domain
}

/** Format a time as Brisbane local (AEST), regardless of the device timezone. */
function brisbaneTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

/** Format duration since sign-in */
function signedInFor(isoStr: string): string {
  try {
    const diff = Math.round((Date.now() - new Date(isoStr).getTime()) / 60000)
    if (diff < 60) return `${diff}m`
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  } catch {
    return '—'
  }
}

// ─── Countdown helper ─────────────────────────────────────────────────────────

function useCountdown(seconds: number, onComplete: () => void) {
  const [remaining, setRemaining] = React.useState(seconds)

  React.useEffect(() => {
    setRemaining(seconds)
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  return remaining
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = React.useState(() => new Date())

  React.useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-right">
      <div className="text-4xl font-bold text-gray-900 tabular-nums">
        {format(time, 'h:mm')}
        <span className="text-2xl text-gray-500 ml-1">{format(time, 'a')}</span>
      </div>
      <div className="text-sm text-gray-500 mt-0.5">
        {format(time, 'EEEE d MMMM yyyy')}
      </div>
    </div>
  )
}

// ─── On-site volunteers table ─────────────────────────────────────────────────

function OnSiteVolunteersTable({
  volunteers,
  signingOut,
  onSignOut,
}: {
  volunteers: OnSiteVolunteer[]
  signingOut: string | null
  onSignOut: (attendanceId: string, name: string) => void
}) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [])

  if (volunteers.length === 0) return null

  return (
    <div className="w-full mt-10">
      <h2 className="text-xl font-bold text-gray-800 mb-3">
        Registered volunteers on site ({volunteers.length})
      </h2>
      <div className="rounded-2xl border-2 border-orange-200 overflow-hidden">
        <table className="w-full text-base">
          <thead className="bg-orange-50 border-b border-orange-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600 text-sm uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600 text-sm uppercase tracking-wide hidden sm:table-cell">Signed in</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600 text-sm uppercase tracking-wide">Duration</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-orange-100">
            {volunteers.map((v) => (
              <tr key={v.id} className="bg-white hover:bg-orange-50 transition-colors">
                <td className="px-5 py-4 font-semibold text-gray-900">
                  {v.firstName} {v.lastName}
                </td>
                <td className="px-5 py-4 text-gray-500 hidden sm:table-cell">
                  {brisbaneTime(v.signInAt)}
                </td>
                <td className="px-5 py-4 font-semibold text-green-600">
                  {signedInFor(v.signInAt)}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => onSignOut(v.id, `${v.firstName} ${v.lastName}`)}
                    disabled={signingOut === v.id}
                    className="flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2.5 text-white font-semibold text-sm transition-colors ml-auto"
                  >
                    {signingOut === v.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    Sign Out
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── On-site guests table ─────────────────────────────────────────────────────

function OnSiteGuestsTable({
  guests,
  signingOut,
  onSignOut,
}: {
  guests: OnSiteGuest[]
  signingOut: string | null
  onSignOut: (id: string, name: string) => void
}) {
  // Tick every minute to update durations
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [])

  if (guests.length === 0) return null

  return (
    <div className="w-full mt-10">
      <h2 className="text-xl font-bold text-gray-800 mb-3">
        Guest volunteers on site ({guests.length})
      </h2>
      <div className="rounded-2xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full text-base">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600 text-sm uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600 text-sm uppercase tracking-wide hidden sm:table-cell">Signed in</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600 text-sm uppercase tracking-wide">Duration</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {guests.map((g) => (
              <tr key={g.id} className="bg-white hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 font-semibold text-gray-900">
                  {g.firstName} {g.lastName}
                  {g.mobile && (
                    <div className="text-sm text-gray-400 font-normal mt-0.5">{maskPhone(g.mobile)}</div>
                  )}
                </td>
                <td className="px-5 py-4 text-gray-500 hidden sm:table-cell">
                  {brisbaneTime(g.signInAt)}
                </td>
                <td className="px-5 py-4 font-semibold text-green-600">
                  {signedInFor(g.signInAt)}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => onSignOut(g.id, `${g.firstName} ${g.lastName}`)}
                    disabled={signingOut === g.id}
                    className="flex items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 px-4 py-2.5 text-white font-semibold text-sm transition-colors ml-auto"
                  >
                    {signingOut === g.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    Sign Out
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KioskClient({ locations, defaultLocationId }: KioskClientProps) {
  const [screen, setScreen] = React.useState<Screen>('home')
  const [selectedLocationId, setSelectedLocationId] = React.useState(
    defaultLocationId ?? locations[0]?.id ?? ''
  )

  // Lookup state
  const [query, setQuery] = React.useState('')
  const [lookupLoading, setLookupLoading] = React.useState(false)
  const [lookupError, setLookupError] = React.useState<string | null>(null)
  const [lookupResults, setLookupResults] = React.useState<VolunteerResult[] | null>(null)
  const [selectedVolunteer, setSelectedVolunteer] = React.useState<VolunteerResult | null>(null)

  // Sign-in/out confirmation state
  const [confirmedName, setConfirmedName] = React.useState('')
  const [confirmedLocation, setConfirmedLocation] = React.useState('')
  const [confirmedTime, setConfirmedTime] = React.useState('')
  const [confirmedDuration, setConfirmedDuration] = React.useState('')
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [actionLoading, setActionLoading] = React.useState(false)

  // Guest form state
  const [guestForm, setGuestForm] = React.useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    organisation: '',
    isCorporateDay: false,
    emergencyContact: '',
    safetyAcknowledged: false,
  })
  const [guestError, setGuestError] = React.useState<string | null>(null)
  const [guestLoading, setGuestLoading] = React.useState(false)

  // On-site volunteers and guests (for sign-out screen)
  const [onSiteVolunteers, setOnSiteVolunteers] = React.useState<OnSiteVolunteer[]>([])
  const [volunteerSigningOut, setVolunteerSigningOut] = React.useState<string | null>(null)
  const [onSiteGuests, setOnSiteGuests] = React.useState<OnSiteGuest[]>([])
  const [guestSigningOut, setGuestSigningOut] = React.useState<string | null>(null)

  const currentLocation = locations.find((l) => l.id === selectedLocationId)

  function resetLookup() {
    setQuery('')
    setLookupError(null)
    setLookupResults(null)
    setSelectedVolunteer(null)
    setActionError(null)
  }

  function goHome() {
    setScreen('home')
    resetLookup()
    setGuestForm({
      firstName: '',
      lastName: '',
      mobile: '',
      email: '',
      organisation: '',
      isCorporateDay: false,
      emergencyContact: '',
      safetyAcknowledged: false,
    })
    setGuestError(null)
    setOnSiteVolunteers([])
    setOnSiteGuests([])
  }

  async function loadOnSiteVolunteers() {
    const result = await kioskGetOnSiteVolunteersAction()
    if (result.success && result.volunteers) {
      setOnSiteVolunteers(result.volunteers)
    }
  }

  async function loadOnSiteGuests() {
    const result = await kioskGetOnSiteGuestsAction()
    if (result.success && result.guests) {
      setOnSiteGuests(result.guests)
    }
  }

  async function handleLookup() {
    if (!query.trim()) return
    setLookupLoading(true)
    setLookupError(null)
    setLookupResults(null)

    const result = await kioskLookupAction(query.trim())
    setLookupLoading(false)

    if (!result.success) {
      setLookupError(result.error ?? 'Search failed.')
      return
    }

    setLookupResults(result.results ?? [])
  }

  async function handleSignIn(volunteer: VolunteerResult) {
    if (!selectedLocationId) {
      setActionError('Please select a location first.')
      return
    }
    setActionLoading(true)
    setActionError(null)

    const result = await kioskSignInAction(volunteer.id, selectedLocationId, currentLocation?.name)
    setActionLoading(false)

    if (!result.success) {
      setActionError(result.error ?? 'Sign-in failed.')
      return
    }

    setConfirmedName(`${volunteer.firstName} ${volunteer.lastName}`)
    setConfirmedLocation(currentLocation?.name ?? '')
    setConfirmedTime(brisbaneTime(new Date()))
    resetLookup()
    setScreen('signin-confirm')
  }

  async function handleSignOut(volunteer: VolunteerResult) {
    setActionLoading(true)
    setActionError(null)

    const response = await fetch(`/api/kiosk/open-attendance?volunteerId=${volunteer.id}`)
    const data = await response.json()
    setActionLoading(false)

    if (!data.attendanceId) {
      setActionError(`${volunteer.firstName} doesn't appear to be signed in right now.`)
      return
    }

    setActionLoading(true)
    const result = await kioskSignOutAction(data.attendanceId)
    setActionLoading(false)

    if (!result.success) {
      setActionError(result.error ?? 'Sign-out failed.')
      return
    }

    setConfirmedName(`${volunteer.firstName} ${volunteer.lastName}`)
    setConfirmedDuration(result.durationLabel ?? '')
    resetLookup()
    setScreen('signout-confirm')
  }

  async function handleOnSiteVolunteerSignOut(attendanceId: string, name: string) {
    setVolunteerSigningOut(attendanceId)
    const result = await kioskSignOutAction(attendanceId)
    setVolunteerSigningOut(null)

    if (!result.success) {
      setActionError(result.error ?? 'Sign-out failed.')
      return
    }

    setConfirmedName(name)
    setConfirmedDuration(result.durationLabel ?? '')
    setScreen('signout-confirm')
    loadOnSiteVolunteers()
    loadOnSiteGuests()
  }

  async function handleGuestSignOut(guestId: string, guestName: string) {
    setGuestSigningOut(guestId)
    const result = await kioskGuestSignOutAction(guestId)
    setGuestSigningOut(null)

    if (!result.success) {
      setActionError(result.error ?? 'Sign-out failed.')
      return
    }

    setConfirmedName(guestName)
    setConfirmedDuration(result.durationLabel ?? '')
    setScreen('signout-confirm')
  }

  async function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuestError(null)

    if (!guestForm.firstName.trim() || !guestForm.lastName.trim()) {
      setGuestError('Please enter your first and last name.')
      return
    }

    if (!guestForm.safetyAcknowledged) {
      setGuestError('Please acknowledge the safety requirements before signing in.')
      return
    }

    setGuestLoading(true)
    const result = await guestSignInAction({
      firstName: guestForm.firstName.trim(),
      lastName: guestForm.lastName.trim(),
      mobile: guestForm.mobile.trim() || undefined,
      email: guestForm.email.trim() || undefined,
      organisation: guestForm.organisation.trim() || undefined,
      isCorporateDay: guestForm.isCorporateDay,
      emergencyContact: guestForm.emergencyContact.trim() || undefined,
      safetyAcknowledged: guestForm.safetyAcknowledged,
      locationId: selectedLocationId || undefined,
      kioskName: currentLocation?.name,
    })
    setGuestLoading(false)

    if (!result.success) {
      setGuestError(result.error ?? 'Guest sign-in failed.')
      return
    }

    setConfirmedName(`${guestForm.firstName} ${guestForm.lastName}`)
    setConfirmedLocation(currentLocation?.name ?? '')
    setConfirmedTime(brisbaneTime(new Date()))
    goHome()
    setScreen('signin-confirm')
  }

  // ─── Screens ──────────────────────────────────────────────────────────────

  if (screen === 'signin-confirm') {
    return (
      <ConfirmScreen
        type="signin"
        name={confirmedName}
        location={confirmedLocation}
        time={confirmedTime}
        onDone={goHome}
      />
    )
  }

  if (screen === 'signout-confirm') {
    return (
      <ConfirmScreen
        type="signout"
        name={confirmedName}
        duration={confirmedDuration}
        onDone={goHome}
      />
    )
  }

  // ─── Guest sign-in screen ──────────────────────────────────────────────────

  if (screen === 'guest-signin') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-amber-500 px-6 py-5 flex items-center gap-4">
          <button
            onClick={() => setScreen('lookup-signin')}
            className="flex items-center gap-2 text-amber-100 hover:text-white transition-colors rounded-lg p-2 hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
            <span className="text-lg font-medium">Back</span>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-white">Guest Sign In</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 max-w-2xl mx-auto w-full">
          <p className="text-gray-600 text-center mb-8 text-lg">
            Visiting for the first time? Fill in your details below.
          </p>

          <form onSubmit={handleGuestSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guestForm.firstName}
                  onChange={(e) => setGuestForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-lg text-gray-900 focus:border-amber-500 focus:outline-none"
                  placeholder="Sarah"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guestForm.lastName}
                  onChange={(e) => setGuestForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-lg text-gray-900 focus:border-amber-500 focus:outline-none"
                  placeholder="Mitchell"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">
                Mobile Number
              </label>
              <input
                type="tel"
                value={guestForm.mobile}
                onChange={(e) => setGuestForm((p) => ({ ...p, mobile: e.target.value }))}
                className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-lg text-gray-900 focus:border-amber-500 focus:outline-none"
                placeholder="0400 000 000"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">
                Email Address{' '}
                <span className="text-amber-600 font-normal text-sm">(recommended)</span>
              </label>
              <p className="text-sm text-gray-500 mb-2">
                We&apos;ll send you info about joining our volunteer team.
              </p>
              <input
                type="email"
                value={guestForm.email}
                onChange={(e) => setGuestForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-lg text-gray-900 focus:border-amber-500 focus:outline-none"
                placeholder="sarah@example.com"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">
                Organisation <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={guestForm.organisation}
                onChange={(e) => setGuestForm((p) => ({ ...p, organisation: e.target.value }))}
                className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-lg text-gray-900 focus:border-amber-500 focus:outline-none"
                placeholder="e.g. Acme Corp, Brisbane City Council"
              />
            </div>

            {/* Corporate volunteer day */}
            <label className="flex items-start gap-4 cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-5 py-4 hover:border-amber-300 transition-colors">
              <input
                type="checkbox"
                checked={guestForm.isCorporateDay}
                onChange={(e) => setGuestForm((p) => ({ ...p, isCorporateDay: e.target.checked }))}
                className="mt-1 h-6 w-6 rounded border-2 border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
              />
              <div>
                <span className="text-base font-semibold text-gray-800">Corporate volunteer day</span>
                <p className="text-sm text-gray-500 mt-0.5">Tick this if you&apos;re here as part of a corporate or community group volunteer day.</p>
              </div>
            </label>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">
                Emergency Contact <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={guestForm.emergencyContact}
                onChange={(e) =>
                  setGuestForm((p) => ({ ...p, emergencyContact: e.target.value }))
                }
                className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-lg text-gray-900 focus:border-amber-500 focus:outline-none"
                placeholder="Name — 0400 000 000"
              />
            </div>

            {/* Safety acknowledgement */}
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-800 mb-3">
                Before signing in, please read our{' '}
                <a
                  href={SAFETY_INFO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-amber-700 hover:text-amber-900"
                >
                  Volunteer Safety Information
                </a>
                .
              </p>
              <label className="flex items-start gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestForm.safetyAcknowledged}
                  onChange={(e) =>
                    setGuestForm((p) => ({ ...p, safetyAcknowledged: e.target.checked }))
                  }
                  className="mt-1 h-6 w-6 rounded border-2 border-amber-400 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
                />
                <span className="text-gray-700 text-base leading-relaxed">
                  <strong>I confirm</strong> that I have read and understand the Lighthouse Care
                  Volunteer Safety Information and will follow all safety instructions and staff
                  directions at all times.
                </span>
              </label>
            </div>

            {guestError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-lg">
                {guestError}
              </div>
            )}

            <button
              type="submit"
              disabled={guestLoading}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-amber-500 px-6 py-5 text-white text-xl font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {guestLoading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <UserPlus className="h-6 w-6" />
                  Sign In as Guest
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Sign in / Sign out lookup screen ─────────────────────────────────────

  if (screen === 'lookup-signin' || screen === 'lookup-signout') {
    const isSignIn = screen === 'lookup-signin'

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-orange-500 px-6 py-5 flex items-center gap-4">
          <button
            onClick={goHome}
            className="flex items-center gap-2 text-orange-100 hover:text-white transition-colors rounded-lg p-2 hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
            <span className="text-lg font-medium">Back</span>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-white">
              {isSignIn ? 'Volunteer Sign In' : 'Volunteer Sign Out'}
            </h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center px-6 py-10 max-w-2xl mx-auto w-full">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            Find your name
          </h2>
          <p className="text-gray-500 text-center mb-8 text-lg">
            Enter your name, email address or mobile number
          </p>

          {/* Search input */}
          <div className="w-full mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setLookupResults(null)
                  setLookupError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="Name, email or mobile number…"
                autoFocus
                className="flex-1 rounded-xl border-2 border-gray-300 px-5 py-4 text-xl text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-0"
              />
              <button
                onClick={handleLookup}
                disabled={!query.trim() || lookupLoading}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-4 text-white text-xl font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {lookupLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Search className="h-6 w-6" />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Errors */}
          {lookupError && (
            <div className="w-full rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-lg mb-4">
              {lookupError}
            </div>
          )}
          {actionError && (
            <div className="w-full rounded-xl bg-orange-50 border border-orange-200 px-5 py-4 text-orange-700 text-lg mb-4">
              {actionError}
            </div>
          )}

          {/* Search results */}
          {lookupResults !== null && (
            <div className="w-full">
              {lookupResults.length === 0 ? (
                /* No results — prompt to sign up (sign-in only) or see staff */
                <div className="text-center py-8">
                  <p className="text-gray-600 text-xl font-semibold mb-2">
                    No volunteers found.
                  </p>
                  {isSignIn ? (
                    <>
                      <p className="text-gray-400 mb-6">
                        Check your spelling, or ask a staff member for help.
                      </p>
                      <a
                        href={`${APP_URL}/signup`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-6 py-4 text-orange-700 font-semibold text-lg hover:bg-orange-100 transition-colors"
                      >
                        <ExternalLink className="h-5 w-5" />
                        Not registered yet? Sign up here
                      </a>
                    </>
                  ) : (
                    <p className="text-gray-400">
                      Please check your details or see a staff member.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-600 font-medium mb-4 text-lg">
                    {lookupResults.length === 1
                      ? '1 volunteer found — is this you?'
                      : `${lookupResults.length} volunteers found — select your name:`}
                  </p>
                  {lookupResults.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVolunteer(v)
                        if (isSignIn) {
                          handleSignIn(v)
                        } else {
                          handleSignOut(v)
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-between rounded-xl border-2 border-gray-200 bg-white px-6 py-5 text-left hover:border-orange-400 hover:bg-orange-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div>
                        <div className="text-xl font-semibold text-gray-900">
                          {v.firstName} {v.lastName}
                        </div>
                        {/* Masked email for privacy */}
                        <div className="text-gray-400 text-sm mt-0.5">{maskEmail(v.email)}</div>
                      </div>
                      {actionLoading && selectedVolunteer?.id === v.id ? (
                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                      ) : (
                        <ChevronRight className="h-6 w-6 text-gray-400 group-hover:text-orange-500 transition-colors" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Guest sign-in link (sign-in screen only) */}
          {isSignIn && (
            <div className="w-full mt-8 pt-8 border-t border-gray-200 text-center">
              <p className="text-gray-500 mb-3">First time here?</p>
              <button
                onClick={() => setScreen('guest-signin')}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-4 text-amber-800 font-semibold text-lg hover:bg-amber-100 transition-colors"
              >
                <UserPlus className="h-5 w-5" />
                Sign in as a guest volunteer
              </button>
            </div>
          )}

          {/* On-site tables (sign-out screen only) */}
          {!isSignIn && (
            <>
              <OnSiteVolunteersTable
                volunteers={onSiteVolunteers}
                signingOut={volunteerSigningOut}
                onSignOut={handleOnSiteVolunteerSignOut}
              />
              <OnSiteGuestsTable
                guests={onSiteGuests}
                signingOut={guestSigningOut}
                onSignOut={handleGuestSignOut}
              />
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── Home screen ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-inline-black.png"
            alt="Lighthouse Care"
            width={180}
            height={44}
            className="object-contain"
            priority
          />
        </div>
        <LiveClock />
      </div>

      {/* Location selector */}
      {locations.length > 1 && (
        <div className="bg-orange-50 border-b border-orange-100 px-6 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <span className="text-sm font-medium text-orange-600">Location:</span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-2">
            Welcome!
          </h1>
          <p className="text-gray-500 text-center text-xl mb-10">
            {currentLocation ? `Signing in at ${currentLocation.name}` : 'Select your action below'}
          </p>

          <div className="space-y-4">
            {/* Sign In */}
            <button
              onClick={() => {
                resetLookup()
                setScreen('lookup-signin')
              }}
              className="w-full flex items-center justify-between rounded-2xl bg-orange-500 px-8 py-7 text-white hover:bg-orange-600 active:scale-[0.99] transition-all shadow-lg shadow-orange-500/30"
            >
              <div className="text-left">
                <div className="text-3xl font-bold">Sign In</div>
                <div className="text-orange-200 mt-1 text-lg">Start your volunteer shift</div>
              </div>
              <LogIn className="h-12 w-12 text-orange-200 shrink-0" aria-hidden="true" />
            </button>

            {/* Sign Out */}
            <button
              onClick={() => {
                resetLookup()
                setScreen('lookup-signout')
                loadOnSiteVolunteers()
                loadOnSiteGuests()
              }}
              className="w-full flex items-center justify-between rounded-2xl bg-white border-2 border-gray-200 px-8 py-7 text-gray-900 hover:border-orange-300 hover:bg-orange-50 active:scale-[0.99] transition-all shadow-sm"
            >
              <div className="text-left">
                <div className="text-3xl font-bold">Sign Out</div>
                <div className="text-gray-500 mt-1 text-lg">Finish your volunteer shift</div>
              </div>
              <LogOut className="h-12 w-12 text-gray-400 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="py-4 text-center text-xs text-gray-400 space-y-1">
        <p>Making lives better so that together we can make the world better.</p>
        <p>
          New volunteer?{' '}
          <a
            href={`${APP_URL}/signup`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-600 underline"
          >
            Sign up here
          </a>
        </p>
      </div>
    </div>
  )
}

// ─── Confirmation screen ──────────────────────────────────────────────────────

function ConfirmScreen({
  type,
  name,
  location,
  time,
  duration,
  onDone,
}: {
  type: 'signin' | 'signout'
  name: string
  location?: string
  time?: string
  duration?: string
  onDone: () => void
}) {
  const countdown = useCountdown(4, onDone)

  if (type === 'signin') {
    return (
      <div className="min-h-screen bg-orange-500 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-6">
          <CheckCircle2 className="h-24 w-24 text-white mx-auto mb-6" aria-hidden="true" />
          <h1 className="text-5xl font-bold text-white mb-3">
            Welcome, {name}!
          </h1>
          <p className="text-orange-200 text-2xl">
            {location ? `You're signed in at ${location}` : "You're signed in"}
          </p>
          {time && (
            <p className="text-orange-300 text-xl mt-2">
              Sign-in time: {time}
            </p>
          )}
        </div>
        <div className="mt-8 text-orange-200 text-lg">
          Returning to home screen in{' '}
          <span className="font-bold text-white text-2xl">{countdown}</span>
          {countdown === 1 ? ' second' : ' seconds'}…
        </div>
        <button
          onClick={onDone}
          className="mt-6 rounded-xl border-2 border-white/30 px-6 py-3 text-white text-lg hover:bg-white/10 transition-colors"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6">
        <LogOut className="h-20 w-20 text-gray-300 mx-auto mb-6" aria-hidden="true" />
        <h1 className="text-5xl font-bold text-white mb-3">
          Goodbye, {name}!
        </h1>
        <p className="text-gray-300 text-2xl">
          Thank you for volunteering today.
        </p>
        {duration && (
          <p className="text-gray-400 text-xl mt-3">
            Duration: <span className="text-white font-semibold">{duration}</span>
          </p>
        )}
      </div>
      <div className="mt-8 text-gray-400 text-lg">
        Returning to home screen in{' '}
        <span className="font-bold text-white text-2xl">{countdown}</span>
        {countdown === 1 ? ' second' : ' seconds'}…
      </div>
      <button
        onClick={onDone}
        className="mt-6 rounded-xl border-2 border-white/30 px-6 py-3 text-white text-lg hover:bg-white/10 transition-colors"
      >
        Done
      </button>
    </div>
  )
}
