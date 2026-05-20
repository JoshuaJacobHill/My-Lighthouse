'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, X, Loader2, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { adminCreateAttendanceAction, adminEditAttendanceAction } from '@/lib/actions/admin.actions'
import { useToast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  signInAt: string   // ISO string
  signOutAt: string | null
  durationMins: number | null
  location: { id: string; name: string } | null
}

interface Location {
  id: string
  name: string
}

interface AdminAttendanceTabProps {
  volunteerId: string
  totalMins: number
  initialRecords: AttendanceRecord[]
  locations: Location[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a UTC ISO string to Brisbane local "datetime-local" input value (YYYY-MM-DDTHH:MM) */
function toDateTimeLocal(iso: string | null): string {
  if (!iso) return ''
  // Brisbane = UTC+10, no DST
  const utc = new Date(iso)
  const brisbane = new Date(utc.getTime() + 10 * 60 * 60 * 1000)
  return brisbane.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
}

/** Format UTC ISO string to readable Brisbane time */
function formatBrisbane(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    ...opts,
  })
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string
  onClose: () => void
  onSubmit: (data: { signInAt: string; signOutAt: string; locationId: string }) => Promise<void>
  initialSignIn?: string
  initialSignOut?: string
  initialLocationId?: string
  locations: Location[]
  loading: boolean
  error: string | null
}

function AttendanceModal({
  title,
  onClose,
  onSubmit,
  initialSignIn = '',
  initialSignOut = '',
  initialLocationId = '',
  locations,
  loading,
  error,
}: ModalProps) {
  const [signInAt, setSignInAt] = React.useState(initialSignIn)
  const [signOutAt, setSignOutAt] = React.useState(initialSignOut)
  const [locationId, setLocationId] = React.useState(initialLocationId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ signInAt, signOutAt, locationId })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Sign in */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Sign-in time <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">Enter Brisbane local time (AEST, UTC+10)</p>
            <input
              type="datetime-local"
              required
              value={signInAt}
              onChange={(e) => setSignInAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Sign out */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Sign-out time{' '}
              <span className="text-gray-400 font-normal">(optional — leave blank if still on site)</span>
            </label>
            <input
              type="datetime-local"
              value={signOutAt}
              onChange={(e) => setSignOutAt(e.target.value)}
              min={signInAt}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            {signInAt && signOutAt && (
              <p className="mt-1.5 text-xs text-gray-500">
                Duration:{' '}
                <span className="font-medium text-orange-600">
                  {(() => {
                    const diff = Math.round(
                      (new Date(signOutAt).getTime() - new Date(signInAt).getTime()) / 60000
                    )
                    return diff > 0 ? formatDuration(diff) : 'Invalid'
                  })()}
                </span>
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">— No location —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminAttendanceTab({
  volunteerId,
  totalMins,
  initialRecords,
  locations,
}: AdminAttendanceTabProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [showAdd, setShowAdd] = React.useState(false)
  const [editRecord, setEditRecord] = React.useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [modalError, setModalError] = React.useState<string | null>(null)

  async function handleCreate(data: { signInAt: string; signOutAt: string; locationId: string }) {
    setLoading(true)
    setModalError(null)
    const result = await adminCreateAttendanceAction(volunteerId, {
      signInAt: data.signInAt,
      signOutAt: data.signOutAt || undefined,
      locationId: data.locationId || undefined,
    })
    setLoading(false)
    if (!result.success) {
      setModalError(result.error ?? 'Failed to create record.')
      return
    }
    setShowAdd(false)
    toast.success('Record added', 'Attendance record created successfully.')
    router.refresh()
  }

  async function handleEdit(data: { signInAt: string; signOutAt: string; locationId: string }) {
    if (!editRecord) return
    setLoading(true)
    setModalError(null)
    const result = await adminEditAttendanceAction(editRecord.id, {
      signInAt: data.signInAt,
      signOutAt: data.signOutAt || undefined,
      locationId: data.locationId || undefined,
    })
    setLoading(false)
    if (!result.success) {
      setModalError(result.error ?? 'Failed to update record.')
      return
    }
    setEditRecord(null)
    toast.success('Record updated', 'Attendance record saved successfully.')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Summary + Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          Total volunteer hours:{' '}
          <span className="font-bold text-orange-600">{formatDuration(totalMins)}</span>
        </p>
        <button
          onClick={() => { setShowAdd(true); setModalError(null) }}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Record
        </button>
      </div>

      {initialRecords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center">
          <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No attendance records yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Sign In</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Sign Out</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Location</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {initialRecords.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-3 text-gray-900">
                    {formatBrisbane(r.signInAt, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {formatBrisbane(r.signInAt, { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </td>
                  <td className="px-4 py-3">
                    {r.signOutAt ? (
                      <span className="text-gray-700 font-medium">
                        {formatBrisbane(r.signOutAt, { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        On site
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {r.durationMins != null ? formatDuration(r.durationMins) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                    {r.location?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setEditRecord(r); setModalError(null) }}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600',
                        'hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors',
                        'opacity-0 group-hover:opacity-100 focus:opacity-100'
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AttendanceModal
          title="Add Attendance Record"
          onClose={() => setShowAdd(false)}
          onSubmit={handleCreate}
          locations={locations}
          loading={loading}
          error={modalError}
        />
      )}

      {/* Edit modal */}
      {editRecord && (
        <AttendanceModal
          title="Edit Attendance Record"
          onClose={() => setEditRecord(null)}
          onSubmit={handleEdit}
          initialSignIn={toDateTimeLocal(editRecord.signInAt)}
          initialSignOut={toDateTimeLocal(editRecord.signOutAt)}
          initialLocationId={editRecord.location?.id ?? ''}
          locations={locations}
          loading={loading}
          error={modalError}
        />
      )}
    </div>
  )
}
