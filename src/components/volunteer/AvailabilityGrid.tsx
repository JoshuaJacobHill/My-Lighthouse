'use client'

import * as React from 'react'
import { Plus, X, Clock } from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type TimePeriod = 'PRE_OPEN' | 'MORNING' | 'AFTERNOON' | 'EVENING'

export interface TimeRange {
  startTime: string // "HH:MM" 24-hour
  endTime: string   // "HH:MM" 24-hour
}

/**
 * Availability stored as a list of time ranges per day.
 */
export type AvailabilityRanges = Partial<Record<DayOfWeek, TimeRange[]>>

/**
 * Legacy map-style type — still used by read-only admin views.
 * @deprecated Use AvailabilityRanges for new code.
 */
export type AvailabilityMap = Partial<Record<DayOfWeek, Partial<Record<TimePeriod, boolean>>>>

export interface TimePeriodConfig {
  key: TimePeriod
  label: string
  hours: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'MONDAY',    label: 'Monday',    short: 'Mon' },
  { key: 'TUESDAY',   label: 'Tuesday',   short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { key: 'THURSDAY',  label: 'Thursday',  short: 'Thu' },
  { key: 'FRIDAY',    label: 'Friday',    short: 'Fri' },
  { key: 'SATURDAY',  label: 'Saturday',  short: 'Sat' },
  { key: 'SUNDAY',    label: 'Sunday',    short: 'Sun' },
]

/** Display-only category guide shown above the editor */
const CATEGORIES = [
  { label: 'Pre-open', hours: '6:00 am – 9:00 am', color: 'bg-purple-100 text-purple-700' },
  { label: 'Morning',  hours: '9:00 am – 12:30 pm', color: 'bg-orange-100 text-orange-700' },
  { label: 'Afternoon', hours: '12:30 pm – 5:00 pm', color: 'bg-blue-100 text-blue-700' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute display category label from a 24h start time string.
 */
export function computeTimePeriod(startTime: string): TimePeriod {
  if (startTime < '09:00') return 'PRE_OPEN'
  if (startTime < '12:30') return 'MORNING'
  return 'AFTERNOON'
}

/** Format "HH:MM" → "9:00 am" */
function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Minutes from midnight for a HH:MM string */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Generate 30-min time options from 06:00 to 20:30 */
function buildTimeOptions(): string[] {
  const opts: string[] = []
  for (let h = 6; h <= 20; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 20) opts.push(`${String(h).padStart(2, '0')}:30`)
  }
  opts.push('20:30')
  return opts
}

const TIME_OPTIONS = buildTimeOptions()

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ startTime }: { startTime: string }) {
  const period = computeTimePeriod(startTime)
  const map: Record<TimePeriod, { label: string; cls: string }> = {
    PRE_OPEN:  { label: 'Pre-open',  cls: 'bg-purple-100 text-purple-700' },
    MORNING:   { label: 'Morning',   cls: 'bg-orange-100 text-orange-700' },
    AFTERNOON: { label: 'Afternoon', cls: 'bg-blue-100 text-blue-700' },
    EVENING:   { label: 'Evening',   cls: 'bg-gray-100 text-gray-600' },
  }
  const { label, cls } = map[period]
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  )
}

// ─── Single day row ───────────────────────────────────────────────────────────

interface DayRowProps {
  day: { key: DayOfWeek; label: string; short: string }
  ranges: TimeRange[]
  onChange: (ranges: TimeRange[]) => void
  readOnly?: boolean
}

function DayRow({ day, ranges, onChange, readOnly = false }: DayRowProps) {
  const [adding, setAdding] = React.useState(false)
  const [newStart, setNewStart] = React.useState('09:00')
  const [newEnd, setNewEnd] = React.useState('12:00')
  const [addError, setAddError] = React.useState('')

  function handleAdd() {
    setAddError('')
    const startMins = toMinutes(newStart)
    const endMins = toMinutes(newEnd)

    if (endMins - startMins < 30) {
      setAddError('Minimum session is 30 minutes.')
      return
    }

    // Check for overlap
    const overlap = ranges.some((r) => {
      const rs = toMinutes(r.startTime)
      const re = toMinutes(r.endTime)
      return startMins < re && endMins > rs
    })
    if (overlap) {
      setAddError('This time overlaps with an existing range.')
      return
    }

    const updated = [...ranges, { startTime: newStart, endTime: newEnd }]
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    onChange(updated)
    setAdding(false)
    setNewStart('09:00')
    setNewEnd('12:00')
  }

  function handleRemove(idx: number) {
    onChange(ranges.filter((_, i) => i !== idx))
  }

  // Filter end time options to only show times >= start + 30 min
  const endOptions = TIME_OPTIONS.filter((t) => toMinutes(t) >= toMinutes(newStart) + 30)

  // Auto-advance end time if it becomes invalid
  React.useEffect(() => {
    if (toMinutes(newEnd) < toMinutes(newStart) + 30) {
      const valid = endOptions[0]
      if (valid) setNewEnd(valid)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newStart])

  return (
    <div className="py-3 border-t border-gray-100 first:border-t-0">
      <div className="flex items-start gap-3">
        {/* Day label */}
        <div className="w-24 shrink-0 pt-1">
          <span className="text-sm font-semibold text-gray-800">{day.label}</span>
        </div>

        {/* Ranges + add */}
        <div className="flex-1 space-y-2">
          {ranges.length === 0 && !adding && (
            <span className="text-sm text-gray-400 italic">No availability set</span>
          )}

          {ranges.map((range, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">
                <Clock className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                {formatTime(range.startTime)} – {formatTime(range.endTime)}
              </div>
              <CategoryBadge startTime={range.startTime} />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  aria-label={`Remove ${formatTime(range.startTime)}–${formatTime(range.endTime)}`}
                  className="rounded-full p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          {/* Inline add form */}
          {adding && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <select
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none bg-white"
                  >
                    {TIME_OPTIONS.filter((t) => t < '20:00').map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                </div>
                <span className="text-gray-400 mt-5">→</span>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <select
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none bg-white"
                  >
                    {endOptions.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setAddError('') }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {addError && (
                <p className="w-full text-xs text-red-600 mt-1">{addError}</p>
              )}
            </div>
          )}

          {!readOnly && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-700 font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add time
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AvailabilityGridProps {
  value: AvailabilityRanges
  onChange?: (updated: AvailabilityRanges) => void
  readOnly?: boolean
  className?: string
  /** Unused — kept for backward compat with old prop passing */
  timePeriods?: TimePeriodConfig[]
}

export function AvailabilityGrid({
  value,
  onChange,
  readOnly = false,
  className,
}: AvailabilityGridProps) {
  function handleDayChange(day: DayOfWeek, ranges: TimeRange[]) {
    if (!onChange) return
    onChange({ ...value, [day]: ranges })
  }

  const totalRanges = Object.values(value).reduce((n, r) => n + (r?.length ?? 0), 0)

  return (
    <div className={clsx('space-y-1', className)}>
      {/* Category legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map((c) => (
          <span key={c.label} className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', c.color)}>
            <Clock className="h-3 w-3" aria-hidden="true" />
            {c.label}: {c.hours}
          </span>
        ))}
      </div>

      {DAYS.map((day) => (
        <DayRow
          key={day.key}
          day={day}
          ranges={value[day.key] ?? []}
          onChange={(ranges) => handleDayChange(day.key, ranges)}
          readOnly={readOnly}
        />
      ))}

      {!readOnly && (
        <p className="pt-2 text-xs text-gray-400">
          Minimum session: 30 minutes. You can add multiple time ranges per day.
        </p>
      )}

      {readOnly && totalRanges === 0 && (
        <p className="text-sm text-gray-400 italic">No availability on record.</p>
      )}
    </div>
  )
}
