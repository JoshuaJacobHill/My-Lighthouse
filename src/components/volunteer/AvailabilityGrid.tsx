'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * These types match the Prisma schema enums (DayOfWeek, TimePeriod).
 * Keep them in sync with prisma/schema.prisma.
 */
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type TimePeriod = 'MORNING' | 'AFTERNOON' | 'EVENING'

/**
 * A set of available slots, keyed by day then time period.
 * A slot is available when its value is `true`.
 */
export type AvailabilityMap = Partial<Record<DayOfWeek, Partial<Record<TimePeriod, boolean>>>>

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'MONDAY', label: 'Monday', short: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday', short: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', short: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday', short: 'Thu' },
  { key: 'FRIDAY', label: 'Friday', short: 'Fri' },
  { key: 'SATURDAY', label: 'Saturday', short: 'Sat' },
  { key: 'SUNDAY', label: 'Sunday', short: 'Sun' },
]

const DEFAULT_TIME_PERIODS: { key: TimePeriod; label: string; hours: string }[] = [
  { key: 'MORNING', label: 'Morning', hours: '9 am – 12 pm' },
  { key: 'AFTERNOON', label: 'Afternoon', hours: '12 pm – 5 pm' },
  { key: 'EVENING', label: 'Evening', hours: '5 pm – 9 pm' },
]

export interface TimePeriodConfig {
  key: TimePeriod
  label: string
  hours: string
}

interface AvailabilityGridProps {
  /** Current availability values */
  value: AvailabilityMap
  /** Provide this to make the grid interactive (editable) */
  onChange?: (updated: AvailabilityMap) => void
  /** When true, the grid is read-only — e.g. for admin view */
  readOnly?: boolean
  className?: string
  /** Optional custom time period labels loaded from app settings */
  timePeriods?: TimePeriodConfig[]
}

function isAvailable(value: AvailabilityMap, day: DayOfWeek, slot: TimePeriod): boolean {
  return !!value[day]?.[slot]
}

export function AvailabilityGrid({
  value,
  onChange,
  readOnly = false,
  className,
  timePeriods,
}: AvailabilityGridProps) {
  const TIME_PERIODS = timePeriods ?? DEFAULT_TIME_PERIODS
  const isEditable = !readOnly && !!onChange

  const toggle = (day: DayOfWeek, slot: TimePeriod) => {
    if (!isEditable) return
    const current = isAvailable(value, day, slot)
    const updated: AvailabilityMap = {
      ...value,
      [day]: {
        ...value[day],
        [slot]: !current,
      },
    }
    onChange!(updated)
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table
        className="w-full min-w-[480px] border-collapse text-sm"
        role={isEditable ? 'grid' : 'table'}
      >
        <caption className="sr-only">
          Weekly availability grid — rows are time periods, columns are days of the week
        </caption>

        {/* Day headers */}
        <thead>
          <tr>
            {/* Empty corner cell */}
            <th
              scope="col"
              className="w-28 py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
              aria-label="Time period"
            />
            {DAYS.map(({ key, label, short }) => (
              <th
                key={key}
                scope="col"
                className="py-2 px-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                <span className="hidden sm:inline">{short}</span>
                <span className="sm:hidden">{short.charAt(0)}</span>
                <span className="sr-only">{label}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {TIME_PERIODS.map(({ key: period, label, hours }) => (
            <tr key={period}>
              {/* Time period label */}
              <th scope="row" className="py-3 pr-3 text-left">
                <span className="font-medium text-gray-700 block">{label}</span>
                <span className="text-xs text-gray-400">{hours}</span>
              </th>

              {/* Day cells */}
              {DAYS.map(({ key: day, label: dayLabel }) => {
                const available = isAvailable(value, day, period)

                return (
                  <td key={day} className="py-3 px-2 text-center align-middle">
                    {isEditable ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={available}
                        aria-label={`${dayLabel} ${label} — ${available ? 'available, click to remove' : 'unavailable, click to add'}`}
                        onClick={() => toggle(day, period)}
                        className={clsx(
                          'mx-auto flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1',
                          available
                            ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:border-orange-600'
                            : 'border-gray-200 bg-white text-transparent hover:border-orange-300 hover:bg-orange-50'
                        )}
                      >
                        <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                      </button>
                    ) : (
                      <div
                        aria-label={`${dayLabel} ${label} — ${available ? 'available' : 'unavailable'}`}
                        className={clsx(
                          'mx-auto flex h-9 w-9 items-center justify-center rounded-lg',
                          available
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-transparent'
                        )}
                      >
                        {available && (
                          <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                        )}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {isEditable && (
        <p className="mt-2 text-xs text-gray-500">
          Click a cell to toggle your availability for that day and time.
        </p>
      )}
    </div>
  )
}
