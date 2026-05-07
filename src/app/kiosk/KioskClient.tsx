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
} from 'lucide-react'
import { format } from 'date-fns'
import {
  kioskLookupAction,
  kioskSignInAction,
  kioskSignOutAction,
  guestSignInAction,
} from '@/lib/actions/kiosk.actions'

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

const VOLUNTEER_AREAS = [
  'Store',
  'Packing',
  'Warehouse',
  'Delivery',
  'Events',
  'Admin',
  'Other',
] as const

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
    volunteerArea: '',
    emergencyContact: '',
    safetyAcknowledged: false,
  })
  const [guestError, setGuestError] = React.useState<string | null>(null)
  const [guestLoading, setGuestLoading] = React.useState(false)

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
      volunteerArea: '',
      emergencyContact: '',
      safetyAcknowledged: false,
    })
    setGuestError(null)
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
    setConfirmedTime(format(new Date(), 'h:mm a'))
    resetLookup()
    setScreen('signin-confirm')
  }

  async function handleSignOut(volunteer: VolunteerResult) {
    setActionLoading(true)
    setActionError(null)

    // Find their current open attendance record by doing a sign-in lookup
    // We need to find the open record — look it up via the sign-out action passing volunteerId
    // The kioskSignOutAction takes an attendanceRecordId so we need a lookup
    // We'll use a separate lookup approach: find the open record via lookup then sign out
    // For now, call with a special pattern — we need the attendanceId
    // Since we don't have it here, we need to fetch it. Let's do a fresh lookup via an API route
    // or we can store it. The cleanest solution: after finding volunteer, fetch open record.

    // For MVP: pass volunteerId to a wrapper — since kiosk actions only expose attendanceRecordId,
    // we need to query the open record. We'll do this inline.
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
      volunteerArea: guestForm.volunteerArea || undefined,
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
    setConfirmedTime(format(new Date(), 'h:mm a'))
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
            Enter your email address or mobile number
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
                placeholder="Email or mobile number…"
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

          {/* Error */}
          {lookupError && (
            <div className="w-full rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-red-700 text-lg mb-4">
              {lookupError}
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div className="w-full rounded-xl bg-orange-50 border border-orange-200 px-5 py-4 text-orange-700 text-lg mb-4">
              {actionError}
            </div>
          )}

          {/* Results */}
          {lookupResults !== null && (
            <div className="w-full">
              {lookupResults.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 text-xl">
                    No volunteers found matching that search.
                  </p>
                  <p className="text-gray-400 mt-2">
                    Please check your details or see a staff member.
                  </p>
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
                        <div className="text-gray-500 text-sm mt-0.5">{v.email}</div>
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
        </div>
      </div>
    )
  }

  if (screen === 'guest-signin') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-amber-500 px-6 py-5 flex items-center gap-4">
          <button
            onClick={goHome}
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
                Email Address <span className="text-gray-400 font-normal">(optional)</span>
              </label>
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
                Volunteer Area
              </label>
              <select
                value={guestForm.volunteerArea}
                onChange={(e) => setGuestForm((p) => ({ ...p, volunteerArea: e.target.value }))}
                className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-lg text-gray-900 focus:border-amber-500 focus:outline-none bg-white"
              >
                <option value="">Select an area…</option>
                {VOLUNTEER_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

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
                  <strong>Safety acknowledgement:</strong> I understand the basic safety requirements
                  for volunteering at Lighthouse Care and will follow staff instructions at all times.
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

          {/* Primary actions */}
          <div className="space-y-4 mb-6">
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

            <button
              onClick={() => {
                resetLookup()
                setScreen('lookup-signout')
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

          {/* Guest sign in */}
          <button
            onClick={() => setScreen('guest-signin')}
            className="w-full flex items-center justify-between rounded-2xl bg-amber-50 border-2 border-amber-200 px-8 py-5 text-amber-800 hover:bg-amber-100 hover:border-amber-300 active:scale-[0.99] transition-all"
          >
            <div className="text-left">
              <div className="text-xl font-bold">Guest Sign In</div>
              <div className="text-amber-600 mt-0.5">First time? Sign in as a guest volunteer</div>
            </div>
            <UserPlus className="h-9 w-9 text-amber-500 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="py-4 text-center text-xs text-gray-400">
        Making lives better so that together we can make the world better.
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
            You&apos;re signed in at {location}
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
