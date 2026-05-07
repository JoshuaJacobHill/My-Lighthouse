'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { bookShiftAction, cancelShiftAction, type RecurringFrequency } from '@/lib/actions/shift.actions'
import { useToast } from '@/components/ui/toast'
import { Loader2, Calendar, MapPin, Clock, Users, Repeat } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ShiftSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  location: string
  title: string | null
  notes: string | null
  capacity: number
  filledCount: number
}

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

interface WeekGroup {
  weekLabel: string
  shifts: ShiftSlot[]
}

interface RosterClientProps {
  availableWeeks: WeekGroup[]
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

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; hint: string }[] = [
  { value: 'ONE_OFF',     label: 'One-off',     hint: 'Just this shift' },
  { value: 'WEEKLY',      label: 'Weekly',      hint: 'Every week' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly', hint: 'Every 2 weeks' },
  { value: 'MONTHLY',     label: 'Monthly',     hint: 'Every 4 weeks' },
]

function ShiftCard({
  shift,
  onBook,
  pending,
}: {
  shift: ShiftSlot
  onBook: (id: string, frequency: RecurringFrequency) => void
  pending: boolean
}) {
  const [frequency, setFrequency] = React.useState<RecurringFrequency>('ONE_OFF')
  const spotsLeft = shift.capacity - shift.filledCount

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        {/* Shift details */}
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
              {shift.title && <span className="text-gray-400"> · {shift.title}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Users className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span>
                {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} available
                <span className="text-gray-400 ml-1">({shift.filledCount}/{shift.capacity} filled)</span>
              </span>
            </div>
            {shift.notes && (
              <p className="text-xs text-gray-500 mt-1 italic">{shift.notes}</p>
            )}
          </div>
        </div>

        {/* Frequency + book */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Repeat:
          </div>
          <div className="flex flex-wrap gap-1.5 flex-1">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFrequency(opt.value)}
                title={opt.hint}
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
          <button
            type="button"
            onClick={() => onBook(shift.id, frequency)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Book{frequency !== 'ONE_OFF' ? ' & Repeat' : ' Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BookedShiftCard({
  shift,
  onCancel,
  pending,
}: {
  shift: BookedShift
  onCancel: (shiftId: string) => void
  pending: boolean
}) {
  const canCancel = shift.status === 'SCHEDULED' || shift.status === 'CONFIRMED'

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
          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
            Booked
          </span>
        </div>
        {canCancel && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onCancel(shift.shiftId)}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Cancel booking
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RosterClient({ availableWeeks, bookedShifts }: RosterClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingShiftId, setPendingShiftId] = React.useState<string | null>(null)

  function handleBook(shiftId: string, frequency: RecurringFrequency) {
    setPendingShiftId(shiftId)
    startTransition(async () => {
      const result = await bookShiftAction(shiftId, frequency)
      setPendingShiftId(null)
      if (result.success) {
        if (frequency === 'ONE_OFF') {
          toast.success('Shift booked!', "You're all set. We'll see you then.")
        } else {
          const count = result.bookedCount ?? 1
          toast.success(
            'Standing shift saved!',
            `Booked ${count} shift${count !== 1 ? 's' : ''} — we'll automatically add new ones as they're rostered.`
          )
        }
        router.refresh()
      } else {
        toast.error('Could not book shift', result.error ?? 'Please try again.')
      }
    })
  }

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

  const hasAvailable = availableWeeks.some((w) => w.shifts.length > 0)

  return (
    <div className="space-y-8">
      {/* Booked shifts */}
      {bookedShifts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Your Upcoming Bookings</h2>
          <div className="space-y-3">
            {bookedShifts.map((shift) => (
              <BookedShiftCard
                key={shift.assignmentId}
                shift={shift}
                onCancel={handleCancel}
                pending={isPending && pendingShiftId === shift.shiftId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available shifts */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Shifts</h2>
        {!hasAvailable ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-600">No upcoming shifts available right now</p>
            <p className="text-sm text-gray-400 mt-1">Check back soon — our team adds new shifts regularly.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {availableWeeks.map((week) =>
              week.shifts.length === 0 ? null : (
                <div key={week.weekLabel}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    {week.weekLabel}
                  </h3>
                  <div className="space-y-3">
                    {week.shifts.map((shift) => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        onBook={handleBook}
                        pending={isPending && pendingShiftId === shift.id}
                    />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  )
}
