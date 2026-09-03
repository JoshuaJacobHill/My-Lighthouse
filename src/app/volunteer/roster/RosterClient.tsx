'use client'

import * as React from 'react'
import { useTransition } from 'react'
import {
  bookCustomShiftAction,
  cancelShiftAction,
  confirmShiftAssignmentAction,
  type RecurringFrequency,
} from '@/lib/actions/shift.actions'
import { useToast } from '@/components/ui/toast'
import { Loader2, Calendar, MapPin, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BookedShift {
  assignmentId: string
  shiftId: string
  date: string
  startTime: string
  endTime: string
  location: string
  title: string | null
  status: string
}

interface RosterClientProps {
  locations: { id: string; name: string }[]
  bookedShifts: BookedShift[]
}

const BRISBANE_TZ = 'Australia/Brisbane'

function formatAusDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: BRISBANE_TZ,
  })
}

function formatTime(dtStr: string) {
  return new Date(dtStr).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: BRISBANE_TZ,
  })
}

// Generate time options 06:00–21:00 in 30-min steps
const TIME_OPTIONS: { value: string; label: string }[] = []
for (let h = 6; h < 21; h++) {
  for (const m of [0, 30]) {
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const period = h < 12 ? 'am' : 'pm'
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
    TIME_OPTIONS.push({ value: `${hh}:${mm}`, label: `${dh}:${mm} ${period}` })
  }
}
// add 21:00 endpoint
TIME_OPTIONS.push({ value: '21:00', label: '9:00 pm' })

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'ONE_OFF',     label: 'One-off' },
  { value: 'WEEKLY',      label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY',     label: 'Monthly' },
]

function getTodayStr(): string {
  const now = new Date()
  // Use Brisbane date (UTC+10)
  const brisbane = new Date(now.getTime() + 10 * 60 * 60 * 1000)
  return brisbane.toISOString().slice(0, 10)
}

function BookedShiftCard({
  shift,
  onCancel,
  onAccept,
  pending,
}: {
  shift: BookedShift
  onCancel: (shiftId: string) => void
  onAccept: (assignmentId: string) => void
  pending: boolean
}) {
  const canCancel = shift.status === 'SCHEDULED' || shift.status === 'CONFIRMED'
  // SCHEDULED means "can you?" — it is a request until they say yes.
  const awaitingAnswer = shift.status === 'SCHEDULED'

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Calendar className="h-4 w-4 text-orange-500 shrink-0" aria-hidden="true" />
            {formatAusDate(shift.date)}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Clock className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
            {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
            {shift.location}
            {shift.title && <span className="text-gray-400">· {shift.title}</span>}
          </div>
          {awaitingAnswer ? (
            <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
              Awaiting your answer
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              Confirmed
            </span>
          )}
        </div>
        {canCancel && (
          <div className="flex shrink-0 gap-2">
            {awaitingAnswer && (
              <button
                type="button"
                onClick={() => onAccept(shift.assignmentId)}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Accept
              </button>
            )}
            <button
              type="button"
              onClick={() => onCancel(shift.shiftId)}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {awaitingAnswer ? 'Decline' : 'Cancel booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RosterClient({ locations, bookedShifts }: RosterClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingShiftId, setPendingShiftId] = React.useState<string | null>(null)

  // Form state
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? '')
  const todayStr = getTodayStr()
  const [date, setDate] = React.useState(todayStr)
  const [startTime, setStartTime] = React.useState('09:00')
  const [endTime, setEndTime] = React.useState('12:00')
  const [frequency, setFrequency] = React.useState<RecurringFrequency>('ONE_OFF')
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // End time options: must be later than startTime (30-min increments ensure >= 30 min gap)
  const endOptions = TIME_OPTIONS.filter((o) => o.value > startTime)

  // If current endTime is no longer valid, reset it
  React.useEffect(() => {
    if (endTime <= startTime) {
      const first = endOptions[0]
      if (first) setEndTime(first.value)
    }
  }, [startTime, endTime, endOptions])

  function handleCancel(shiftId: string) {
    setPendingShiftId(shiftId)
    startTransition(async () => {
      const result = await cancelShiftAction(shiftId)
      setPendingShiftId(null)
      if (result.success) {
        toast.success('Booking cancelled', 'Your shift booking has been cancelled.')
        router.refresh()
      } else {
        toast.error('Could not cancel', result.error ?? 'Please try again.')
      }
    })
  }

  function handleAccept(assignmentId: string) {
    const shift = bookedShifts.find((b) => b.assignmentId === assignmentId)
    setPendingShiftId(shift?.shiftId ?? null)
    startTransition(async () => {
      const result = await confirmShiftAssignmentAction(assignmentId)
      setPendingShiftId(null)
      if (result.success) {
        toast.success('Thanks for confirming', 'You are down for that shift.')
        // No router.refresh(): the action revalidates this page already.
      } else {
        toast.error('Could not confirm', result.error ?? 'Please try again.')
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    // Sunday check (UTC day matches calendar date when using YYYY-MM-DD)
    if (new Date(date).getUTCDay() === 0) {
      setFormError("We're closed on Sundays — please choose another day.")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await bookCustomShiftAction({ locationId, date, startTime, endTime, frequency })
      if (result.success) {
        if (frequency === 'ONE_OFF') {
          toast.success('Shift booked!', "You're all set. We'll see you then.")
        } else {
          const count = result.bookedCount ?? 1
          toast.success(
            'Standing shift saved!',
            `Booked ${count} shift${count !== 1 ? 's' : ''}.`
          )
        }
        router.refresh()
      } else {
        setFormError(result.error ?? 'Could not book shift. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Booking form */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Book a Shift</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Location */}
            <div>
              <label htmlFor="locationId" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                id="locationId"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                min={todayStr}
                onChange={(e) => setDate(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* From / To times */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                  From
                </label>
                <select
                  id="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {TIME_OPTIONS.filter((o) => o.value < '21:00').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <select
                  id="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {endOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Repeat */}
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Repeat</span>
              <div className="flex flex-wrap gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value)}
                    className={[
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                      frequency === opt.value
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {formError && (
              <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                {formError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || isPending}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {frequency !== 'ONE_OFF' ? 'Book & Repeat' : 'Book Shift'}
            </button>
          </form>
        </div>
      </section>

      {/* Upcoming bookings */}
      {bookedShifts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Your Upcoming Bookings</h2>
          <div className="space-y-3">
            {bookedShifts.map((shift) => (
              <BookedShiftCard
                key={shift.assignmentId}
                shift={shift}
                onCancel={handleCancel}
                onAccept={handleAccept}
                pending={isPending && pendingShiftId === shift.shiftId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
