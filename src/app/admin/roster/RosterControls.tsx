'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface Location {
  id: string
  name: string
}

interface RosterControlsProps {
  view: 'day' | 'week' | 'month'
  locationId: string
  locations: Location[]
  currentDate?: string  // for day view
  currentWeek?: string  // for week view
  currentMonth?: string // for month view (YYYY-MM)
}

export function RosterControls({
  view,
  locationId,
  locations,
  currentDate,
  currentWeek,
  currentMonth,
}: RosterControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined || val === '') {
        params.delete(key)
      } else {
        params.set(key, val)
      }
    }
    return `${pathname}?${params.toString()}`
  }

  function handleViewChange(newView: 'day' | 'week' | 'month') {
    const overrides: Record<string, string | undefined> = { view: newView }
    router.push(buildUrl(overrides))
  }

  function handleLocationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(buildUrl({ location: e.target.value || undefined }))
  }

  const VIEW_LABELS: { id: 'day' | 'week' | 'month'; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* View toggle */}
      <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
        {VIEW_LABELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleViewChange(id)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              view === id
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Location filter */}
      <select
        value={locationId}
        onChange={handleLocationChange}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
      >
        <option value="">All Locations</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  )
}
