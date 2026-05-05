'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Loader2, Save } from 'lucide-react'
import { format } from 'date-fns'

interface Location {
  id: string
  name: string
}

interface Department {
  id: string
  name: string
}

interface ShiftData {
  id: string
  date: string | Date
  startTime: string | Date
  endTime: string | Date
  locationId: string
  departmentId: string | null
  title: string | null
  capacity: number
  notes: string | null
}

interface EditShiftModalProps {
  shift: ShiftData
  locations: Location[]
  departments: Department[]
}

export function EditShiftModal({ shift, locations, departments }: EditShiftModalProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [form, setForm] = React.useState(() => ({
    date: format(new Date(shift.date), 'yyyy-MM-dd'),
    startTime: format(new Date(shift.startTime), 'HH:mm'),
    endTime: format(new Date(shift.endTime), 'HH:mm'),
    locationId: shift.locationId,
    departmentId: shift.departmentId ?? '',
    title: shift.title ?? '',
    capacity: shift.capacity,
    notes: shift.notes ?? '',
  }))

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.locationId) {
      setError('Please select a location.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/shifts/${shift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          startTime: `${form.date}T${form.startTime}:00`,
          endTime: `${form.date}T${form.endTime}:00`,
          locationId: form.locationId,
          departmentId: form.departmentId || null,
          title: form.title || null,
          capacity: form.capacity,
          notes: form.notes || null,
        }),
      })
      const result = await response.json()

      if (!result.success) {
        setError(result.error ?? 'Failed to update shift.')
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        aria-label="Edit shift"
        title="Edit shift"
      >
        <Pencil className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Shift</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => update('startTime', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => update('endTime', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.locationId}
              onChange={(e) => update('locationId', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white"
            >
              <option value="">Select location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={form.departmentId}
              onChange={(e) => update('departmentId', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white"
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shift Title <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Morning packing shift"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (volunteers needed)
            </label>
            <input
              type="number"
              required
              min={1}
              max={100}
              value={form.capacity}
              onChange={(e) => update('capacity', parseInt(e.target.value) || 1)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Any special instructions or notes for this shift…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
