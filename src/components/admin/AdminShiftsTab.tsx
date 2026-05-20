'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Loader2, X, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  adminBookShiftForVolunteerAction,
  adminCancelShiftAssignmentAction,
} from '@/lib/actions/shift.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShiftAssignment {
  id: string
  status: string
  shift: {
    date: string
    startTime: string
    endTime: string
    location: { name: string }
    department: { name: string } | null
  }
}

interface Location {
  id: string
  name: string
}

interface AdminShiftsTabProps {
  volunteerId: string
  initialAssignments: ShiftAssignment[]
  locations: Location[]
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

const BRISBANE_TZ = 'Australia/Brisbane'

function formatShiftDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: BRISBANE_TZ,
  })
}

function formatShiftTime(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: BRISBANE_TZ,
    })
  return `${fmt(startIso)} – ${fmt(endIso)}`
}

/** Generate 30-minute time slots from 06:00 to 20:30 */
function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 6; h <= 20; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20 || true) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  // Remove anything past 20:30
  return slots.filter((s) => s <= '20:30')
}

const TIME_SLOTS = generateTimeSlots()

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED_BY_VOLUNTEER: 'bg-gray-100 text-gray-700',
  ATTENDED: 'bg-orange-100 text-orange-700',
  NO_SHOW: 'bg-red-100 text-red-800',
  ADMIN_CANCELLED: 'bg-orange-100 text-orange-800',
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED_BY_VOLUNTEER: 'Cancelled by volunteer',
  ATTENDED: 'Attended',
  NO_SHOW: 'No show',
  ADMIN_CANCELLED: 'Admin cancelled',
}

function ShiftStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STATUS_COLOURS[status] ?? 'bg-gray-100 text-gray-700'
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Cancel button ────────────────────────────────────────────────────────────

function CancelAssignmentButton({ assignmentId, onDone }: { assignmentId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleCancel() {
    startTransition(async () => {
      const result = await adminCancelShiftAssignmentAction(assignmentId)
      if (result.success) {
        toast.success('Shift cancelled', 'The shift assignment has been cancelled.')
        onDone()
      } else {
        toast.error('Could not cancel shift', result.error ?? 'Please try again.')
      }
    })
  }

  return (
    <button
      onClick={handleCancel}
      disabled={isPending}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
      title="Cancel this shift"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      Cancel
    </button>
  )
}

// ─── Book Shift Modal ─────────────────────────────────────────────────────────

type Frequency = 'ONCE' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'ONCE', label: 'Once' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
]

interface BookShiftModalProps {
  volunteerId: string
  locations: Location[]
  onClose: () => void
  onBooked: () => void
}

function BookShiftModal({ volunteerId, locations, onClose, onBooked }: BookShiftModalProps) {
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? '')
  const [date, setDate] = React.useState('')
  const [startTime, setStartTime] = React.useState('09:00')
  const [endTime, setEndTime] = React.useState('12:30')
  const [frequency, setFrequency] = React.useState<Frequency>('ONCE')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) {
      toast.error('Date required', 'Please select a date for the shift.')
      return
    }
    if (startTime >= endTime) {
      toast.error('Invalid times', 'End time must be after start time.')
      return
    }

    startTransition(async () => {
      const result = await adminBookShiftForVolunteerAction(volunteerId, {
        locationId,
        date,
        startTime,
        endTime,
        frequency,
      })
      if (result.success) {
        const count = result.bookedCount ?? 1
        toast.success(
          'Shift booked',
          count > 1
            ? `${count} shifts booked successfully.`
            : 'Shift booked successfully.'
        )
        onBooked()
      } else {
        toast.error('Could not book shift', result.error ?? 'Please try again.')
      }
    })
  }

  // Filter end time options: must be after startTime
  const endTimeOptions = TIME_SLOTS.filter((t) => t > startTime)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-shift-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="book-shift-title" className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-500" aria-hidden="true" />
            Book Shift
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Location */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="book-location">
              Location
            </label>
            <select
              id="book-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="book-date">
              Date
            </label>
            <input
              id="book-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700" htmlFor="book-start">
                From
              </label>
              <select
                id="book-start"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value)
                  // If endTime is no longer valid, push it forward
                  if (endTime <= e.target.value) {
                    const nextEnd = TIME_SLOTS.find((t) => t > e.target.value)
                    if (nextEnd) setEndTime(nextEnd)
                  }
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700" htmlFor="book-end">
                To
              </label>
              <select
                id="book-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {endTimeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-gray-700">Frequency</span>
            <div className="flex flex-wrap gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={clsx(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    frequency === opt.value
                      ? 'bg-orange-500 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Booking…
                </>
              ) : (
                'Book Shift'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminShiftsTab({ volunteerId, initialAssignments, locations }: AdminShiftsTabProps) {
  const router = useRouter()
  const [showModal, setShowModal] = React.useState(false)

  function refresh() {
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Shift Assignments</h3>
        <Button size="sm" onClick={() => setShowModal(true)}>
          Book Shift
        </Button>
      </div>

      {/* Table */}
      {initialAssignments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500">No shift assignments recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {initialAssignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                    {formatShiftDate(a.shift.date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatShiftTime(a.shift.startTime, a.shift.endTime)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.shift.location.name}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {a.shift.department?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ShiftStatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
                      <CancelAssignmentButton assignmentId={a.id} onDone={refresh} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <BookShiftModal
          volunteerId={volunteerId}
          locations={locations}
          onClose={() => setShowModal(false)}
          onBooked={() => {
            setShowModal(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
