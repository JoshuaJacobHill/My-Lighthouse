'use client'

import * as React from 'react'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'

export type AvailabilityPeriodKey = 'PRE_OPEN' | 'MORNING' | 'AFTERNOON'

/**
 * Map of day → array of selected time periods.
 * An empty array (or missing key) means unavailable that day.
 */
export type AvailabilityPeriodMap = Partial<Record<DayOfWeek, AvailabilityPeriodKey[]>>

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY',    label: 'Monday' },
  { key: 'TUESDAY',  label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY',   label: 'Friday' },
  { key: 'SATURDAY', label: 'Saturday' },
]

export const PERIODS: {
  key: AvailabilityPeriodKey
  label: string
  hours: string
  startTime: string
  endTime: string
  color: string
  checked: string
}[] = [
  {
    key: 'PRE_OPEN',
    label: 'Pre-open',
    hours: '6:00 – 9:00 am',
    startTime: '06:00',
    endTime: '09:00',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    checked: 'bg-purple-500 border-purple-500',
  },
  {
    key: 'MORNING',
    label: 'Morning',
    hours: '9:00 am – 12:30 pm',
    startTime: '09:00',
    endTime: '12:30',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    checked: 'bg-orange-500 border-orange-500',
  },
  {
    key: 'AFTERNOON',
    label: 'Afternoon',
    hours: '12:30 – 5:00 pm',
    startTime: '12:30',
    endTime: '17:00',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    checked: 'bg-blue-500 border-blue-500',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface AvailabilityCheckboxGridProps {
  value: AvailabilityPeriodMap
  onChange?: (updated: AvailabilityPeriodMap) => void
  readOnly?: boolean
  className?: string
}

export function AvailabilityCheckboxGrid({
  value,
  onChange,
  readOnly = false,
  className,
}: AvailabilityCheckboxGridProps) {
  function toggle(day: DayOfWeek, period: AvailabilityPeriodKey) {
    if (readOnly || !onChange) return
    const current = value[day] ?? []
    const next = current.includes(period)
      ? current.filter((p) => p !== period)
      : [...current, period]
    onChange({ ...value, [day]: next })
  }

  function isChecked(day: DayOfWeek, period: AvailabilityPeriodKey) {
    return (value[day] ?? []).includes(period)
  }

  const hasAny = Object.values(value).some((periods) => periods && periods.length > 0)

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr>
            {/* Day column header */}
            <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28" />
            {PERIODS.map((p) => (
              <th key={p.key} className="pb-3 text-center px-2">
                <div className={clsx(
                  'inline-flex flex-col items-center rounded-xl px-3 py-2 border',
                  p.color,
                )}>
                  <span className="font-semibold text-xs">{p.label}</span>
                  <span className="text-xs opacity-75 mt-0.5">{p.hours}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day, idx) => (
            <tr
              key={day.key}
              className={clsx(
                'border-t border-gray-100',
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
              )}
            >
              <td className="py-3 pr-2 font-medium text-gray-800 text-sm">{day.label}</td>
              {PERIODS.map((period) => {
                const checked = isChecked(day.key, period.key)
                return (
                  <td key={period.key} className="py-3 px-2 text-center">
                    {readOnly ? (
                      /* Read-only pill */
                      checked ? (
                        <span className={clsx(
                          'inline-flex items-center justify-center w-8 h-8 rounded-full border',
                          period.color,
                        )}>
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-label="Available">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white">
                          <span className="w-2 h-2 rounded-full bg-gray-200" aria-label="Not available" />
                        </span>
                      )
                    ) : (
                      /* Interactive checkbox */
                      <label className="flex items-center justify-center cursor-pointer group">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggle(day.key, period.key)}
                          aria-label={`${day.label} ${period.label}`}
                        />
                        <span
                          aria-hidden="true"
                          className={clsx(
                            'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-150',
                            checked
                              ? clsx('text-white', period.checked)
                              : 'border-gray-300 bg-white group-hover:border-gray-400',
                          )}
                        >
                          {checked && (
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      </label>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {readOnly && !hasAny && (
        <p className="mt-3 text-sm text-gray-400 italic">No availability on record.</p>
      )}
    </div>
  )
}
