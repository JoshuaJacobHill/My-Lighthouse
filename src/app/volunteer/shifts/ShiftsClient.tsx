'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  bookCustomShiftAction,
  cancelShiftAction,
  editShiftBookingAction,
} from '@/lib/actions/shift.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignmentData {
  id: string
  status: string
  cancelReason: string | null
  shift: {
    id: string
    date: string
    startTime: string
    endTime: string
    location: { id: string; name: string }
  }
}

interface LocationOption {
  id: string
  name: string
}

interface ShiftsClientProps {
  assignments: AssignmentData[]
  locations: LocationOption[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRISBANE_TZ = 'Australia/Brisbane'

const TIME_OPTIONS: { value: string; label: string }[] = []
for (let h = 6; h < 21; h++) {
  for (const m of [0, 30]) {
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const period = h < 12 ? 'am' : 'pm'
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
    TIME_OPTIONS.push({ value: `${hh}:${mm}`, label: `${dh}:${mm} ${period}` })
  }
}
// add 21:00 endpoint
TIME_OPTIONS.push({ value: '21:00', label: '9:00 pm' })

type RecurringFrequency = 'ONE_OFF' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

const FREQ_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'ONE_OFF', label: 'One-off' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
]

const STATUS_COLOURS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 border border-blue-200',
  CONFIRMED: 'bg-green-100 text-green-800 border border-green-200',
  CANCELLED_BY_VOLUNTEER: 'bg-gray-100 text-gray-600 border border-gray-200',
  ATTENDED: 'bg-orange-100 text-orange-700 border border-orange-200',
  NO_SHOW: 'bg-red-100 text-red-800 border border-red-200',
  ADMIN_CANCELLED: 'bg-gray-100 text-gray-600 border border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED_BY_VOLUNTEER: 'Cancelled',
  ATTENDED: 'Attended',
  NO_SHOW: 'No show',
  ADMIN_CANCELLED: 'Cancelled',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBrisbaneDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: BRISBANE_TZ,
  })
}

function formatBrisbaneTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: BRISBANE_TZ,
  })
}

// Shift dates are stored as UTC midnight of the Brisbane calendar date —
// extract the UTC date string which matches the Brisbane calendar date.
function shiftDateStr(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function getTodayStr(): string {
  const now = new Date()
  const brisbane = new Date(now.getTime() + 10 * 60 * 60 * 1000)
  return brisbane.toISOString().slice(0, 10)
}

function extractTime(iso: string): string {
  // Returns HH:MM in Brisbane time
  const d = new Date(iso)
  const bris = new Date(d.getTime() + 10 * 60 * 60 * 1000)
  const h = String(bris.getUTCHours()).padStart(2, '0')
  const m = String(bris.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// ─── UpcomingShiftRow ─────────────────────────────────────────────────────────

function UpcomingShiftRow({
  assignment,
  onEdit,
  onCancel,
}: {
  assignment: AssignmentData
  onEdit: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          {formatBrisbaneDate(assignment.shift.date)}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">
          {formatBrisbaneTime(assignment.shift.startTime)} – {formatBrisbaneTime(assignment.shift.endTime)}
          {' · '}
          {assignment.shift.location.name}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            STATUS_COLOURS[assignment.status] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {STATUS_LABELS[assignment.status] ?? assignment.status}
        </span>
        {(assignment.status === 'SCHEDULED' || assignment.status === 'CONFIRMED') && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-red-50 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Can&apos;t make it?
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── BookingModal ─────────────────────────────────────────────────────────────

function BookingModal({
  locations,
  initialDate,
  onClose,
  onSuccess,
}: {
  locations: LocationOption[]
  initialDate: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const todayStr = getTodayStr()
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? '')
  const [date, setDate] = React.useState(initialDate || todayStr)
  const [startTime, setStartTime] = React.useState('09:00')
  const [endTime, setEndTime] = React.useState('12:00')
  const [frequency, setFrequency] = React.useState<RecurringFrequency>('ONE_OFF')
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const endOptions = TIME_OPTIONS.filter((o) => o.value > startTime)

  React.useEffect(() => {
    if (endTime <= startTime) {
      const first = endOptions[0]
      if (first) setEndTime(first.value)
    }
  }, [startTime, endTime, endOptions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (new Date(date).getUTCDay() === 0) {
      setFormError("We're closed on Sundays — please choose another day.")
      return
    }
    setIsSubmitting(true)
    try {
      const result = await bookCustomShiftAction({ locationId, date, startTime, endTime, frequency })
      if (result.success) {
        const count = result.bookedCount ?? 1
        if (frequency === 'ONE_OFF') {
          toast.success('Shift booked!', "You're all set. We'll see you then.")
        } else {
          toast.success('Standing shift saved!', `Booked ${count} shift${count !== 1 ? 's' : ''}.`)
        }
        onSuccess()
      } else {
        setFormError(result.error ?? 'Could not book shift. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Book a Shift</h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose your location, date, and times — no approval needed.
        </p>

        <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800">
          <p className="font-semibold mb-0.5">Trading hours:</p>
          <p>Loganholme: Mon–Fri 9am–5pm, Sat 9am–4pm</p>
          <p>Hillcrest: Mon–Fri 9am–5pm, Sat 9am–12pm</p>
          <p>Closed Sundays</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="bk-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              id="bk-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bk-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              id="bk-date"
              type="date"
              value={date}
              min={todayStr}
              onChange={(e) => setDate(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="bk-start" className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <select
                id="bk-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {TIME_OPTIONS.filter((o) => o.value < '21:00').map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="bk-end" className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <select
                id="bk-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {endOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Repeat</span>
            <div className="flex flex-wrap gap-2">
              {FREQ_OPTIONS.map((opt) => (
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

          {formError && (
            <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {frequency !== 'ONE_OFF' ? 'Book & Repeat' : 'Book Shift'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({
  assignment,
  locations,
  onClose,
  onSuccess,
}: {
  assignment: AssignmentData
  locations: LocationOption[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const todayStr = getTodayStr()

  const [locationId, setLocationId] = React.useState(assignment.shift.location.id)
  const [date, setDate] = React.useState(shiftDateStr(assignment.shift.date))
  const [startTime, setStartTime] = React.useState(extractTime(assignment.shift.startTime))
  const [endTime, setEndTime] = React.useState(extractTime(assignment.shift.endTime))
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isCancelling, setIsCancelling] = React.useState(false)

  const endOptions = TIME_OPTIONS.filter((o) => o.value > startTime)

  React.useEffect(() => {
    if (endTime <= startTime) {
      const first = endOptions[0]
      if (first) setEndTime(first.value)
    }
  }, [startTime, endTime, endOptions])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (new Date(date).getUTCDay() === 0) {
      setFormError("We're closed on Sundays — please choose another day.")
      return
    }
    setIsSaving(true)
    try {
      const result = await editShiftBookingAction(assignment.id, { locationId, date, startTime, endTime })
      if (result.success) {
        toast.success('Booking updated', 'Your shift has been updated.')
        onSuccess()
      } else {
        setFormError(result.error ?? 'Could not update booking. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancel() {
    setIsCancelling(true)
    try {
      const result = await cancelShiftAction(assignment.shift.id)
      if (result.success) {
        toast.success('Booking cancelled', 'Your shift booking has been cancelled.')
        onSuccess()
      } else {
        setFormError(result.error ?? 'Could not cancel booking. Please try again.')
      }
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Edit Shift</h2>
        <p className="text-sm text-gray-500 mb-4">
          Update the details for this shift booking.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="ed-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              id="ed-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ed-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              id="ed-date"
              type="date"
              value={date}
              min={todayStr}
              onChange={(e) => setDate(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="ed-start" className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <select
                id="ed-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {TIME_OPTIONS.filter((o) => o.value < '21:00').map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="ed-end" className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <select
                id="ed-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {endOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving || isCancelling}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving || isCancelling}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Cancel Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ShiftsClient({ assignments, locations }: ShiftsClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const now = new Date()
  const [displayYear, setDisplayYear] = React.useState(now.getFullYear())
  const [displayMonth, setDisplayMonth] = React.useState(now.getMonth())
  const [showBooking, setShowBooking] = React.useState(false)
  const [bookingDate, setBookingDate] = React.useState('')
  const [editAssignment, setEditAssignment] = React.useState<AssignmentData | null>(null)
  const [localAssignments, setLocalAssignments] = React.useState<AssignmentData[]>(assignments)

  // Calendar grid
  const firstDay = new Date(displayYear, displayMonth, 1)
  const gridStart = startOfWeek(firstDay, { weekStartsOn: 1 })
  const gridEnd = startOfWeek(new Date(displayYear, displayMonth + 1, 1), { weekStartsOn: 1 })
  // gridEnd is the Monday of the week after month end — go to Sunday before it
  const calendarEnd = new Date(gridEnd.getTime() - 86_400_000)
  // But if month end falls on a Sunday we already need that week
  const monthEnd = endOfMonth(firstDay)
  const actualGridEnd = calendarEnd >= monthEnd ? calendarEnd : new Date(calendarEnd.getTime() + 7 * 86_400_000)

  const calendarDays = eachDayOfInterval({ start: gridStart, end: actualGridEnd })

  function prevMonth() {
    const prev = subMonths(firstDay, 1)
    setDisplayYear(prev.getFullYear())
    setDisplayMonth(prev.getMonth())
  }

  function nextMonth() {
    const next = addMonths(firstDay, 1)
    setDisplayYear(next.getFullYear())
    setDisplayMonth(next.getMonth())
  }

  function openEditModal(a: AssignmentData) {
    setEditAssignment(a)
  }

  function handleCancel(shiftId: string, assignmentId: string) {
    cancelShiftAction(shiftId).then((result) => {
      if (result.success) {
        toast.success('Booking cancelled', 'Your shift booking has been cancelled.')
        setLocalAssignments((prev) =>
          prev.map((a) =>
            a.id === assignmentId ? { ...a, status: 'CANCELLED_BY_VOLUNTEER' } : a
          )
        )
      } else {
        toast.error('Could not cancel', result.error ?? 'Please try again.')
      }
    })
  }

  const upcomingAssignments = localAssignments
    .filter(
      (a) =>
        ['SCHEDULED', 'CONFIRMED'].includes(a.status) &&
        new Date(a.shift.startTime) >= now
    )
    .sort((a, b) => new Date(a.shift.startTime).getTime() - new Date(b.shift.startTime).getTime())

  return (
    <div className="space-y-6">
      {/* Calendar card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">
            {format(firstDay, 'MMMM yyyy')}
          </h2>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
          {calendarDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayAssignments = localAssignments.filter(
              (a) =>
                shiftDateStr(a.shift.date) === dateStr &&
                ['SCHEDULED', 'CONFIRMED', 'ATTENDED'].includes(a.status)
            )
            const isCurrentMonth = isSameMonth(day, firstDay)
            const todayDate = new Date(new Date().toDateString())
            const isPast = day < todayDate
            const isSun = day.getDay() === 0
            const isClickable = !isPast && !isSun && isCurrentMonth && dayAssignments.length === 0

            return (
              <div
                key={dateStr}
                className={[
                  'bg-white min-h-[64px] p-1.5',
                  !isCurrentMonth && 'bg-gray-50',
                  isToday(day) && 'bg-orange-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  if (isClickable) {
                    setBookingDate(dateStr)
                    setShowBooking(true)
                  }
                }}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
                <span
                  className={[
                    'text-xs font-medium flex items-center justify-center w-5 h-5 rounded-full',
                    isToday(day)
                      ? 'bg-orange-500 text-white'
                      : isCurrentMonth
                      ? 'text-gray-700'
                      : 'text-gray-300',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </span>
                {dayAssignments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditModal(a)
                    }}
                    className="mt-0.5 w-full text-left rounded px-1 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 truncate block focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {formatBrisbaneTime(a.shift.startTime)}–{formatBrisbaneTime(a.shift.endTime)}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* Book a shift button */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setBookingDate('')
              setShowBooking(true)
            }}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            + Book a Shift
          </button>
        </div>
      </div>

      {/* Upcoming shifts list */}
      {upcomingAssignments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Upcoming</h2>
          <div className="space-y-2">
            {upcomingAssignments.slice(0, 5).map((a) => (
              <UpcomingShiftRow
                key={a.id}
                assignment={a}
                onEdit={() => openEditModal(a)}
                onCancel={() => handleCancel(a.shift.id, a.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Booking modal */}
      {showBooking && (
        <BookingModal
          locations={locations}
          initialDate={bookingDate}
          onClose={() => setShowBooking(false)}
          onSuccess={() => {
            setShowBooking(false)
            router.refresh()
          }}
        />
      )}

      {/* Edit modal */}
      {editAssignment && (
        <EditModal
          assignment={editAssignment}
          locations={locations}
          onClose={() => setEditAssignment(null)}
          onSuccess={() => {
            setEditAssignment(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
