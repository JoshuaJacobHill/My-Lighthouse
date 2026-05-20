'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, X, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { adminEditAttendanceAction } from '@/lib/actions/admin.actions'
import { useToast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttendanceRow {
  id: string
  signInAt: string   // ISO
  signOutAt: string | null
  durationMins: number | null
  volunteer: { id: string; firstName: string; lastName: string }
  location: { id: string; name: string } | null
}

interface Location {
  id: string
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return ''
  const brisbane = new Date(new Date(iso).getTime() + 10 * 60 * 60 * 1000)
  return brisbane.toISOString().slice(0, 16)
}

function formatBrisbane(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', ...opts })
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  record,
  locations,
  onClose,
}: {
  record: AttendanceRow
  locations: Location[]
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [signInAt, setSignInAt] = React.useState(toDateTimeLocal(record.signInAt))
  const [signOutAt, setSignOutAt] = React.useState(toDateTimeLocal(record.signOutAt))
  const [locationId, setLocationId] = React.useState(record.location?.id ?? '')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const durationPreview = React.useMemo(() => {
    if (!signInAt || !signOutAt) return null
    const diff = Math.round(
      (new Date(signOutAt).getTime() - new Date(signInAt).getTime()) / 60000
    )
    return diff > 0 ? formatDuration(diff) : null
  }, [signInAt, signOutAt])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await adminEditAttendanceAction(record.id, {
      signInAt,
      signOutAt: signOutAt || undefined,
      locationId: locationId || undefined,
    })
    setLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Failed to save changes.')
      return
    }
    toast.success('Record updated', 'Attendance record saved successfully.')
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Attendance Record</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {record.volunteer.firstName} {record.volunteer.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Sign-in time <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">Brisbane local time (AEST, UTC+10)</p>
            <input
              type="datetime-local"
              required
              value={signInAt}
              onChange={(e) => setSignInAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Sign-out time{' '}
              <span className="text-gray-400 font-normal">(leave blank if still on site)</span>
            </label>
            <input
              type="datetime-local"
              value={signOutAt}
              onChange={(e) => setSignOutAt(e.target.value)}
              min={signInAt}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            {durationPreview && (
              <p className="mt-1.5 text-xs text-gray-500">
                Duration: <span className="font-medium text-orange-600">{durationPreview}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function AttendanceTableClient({
  records,
  locations,
  totalMins,
}: {
  records: AttendanceRow[]
  locations: Location[]
  totalMins: number
}) {
  const [editRecord, setEditRecord] = React.useState<AttendanceRow | null>(null)

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
        <p className="text-sm text-gray-500">No attendance records in this period.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {records.length} record{records.length !== 1 ? 's' : ''} &mdash; total hours:{' '}
          <strong>{formatDuration(totalMins)}</strong>
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Volunteer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Sign In</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Sign Out</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Location</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 group">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/volunteers/${r.volunteer.id}`}
                        className="font-medium text-orange-600 hover:text-orange-700"
                      >
                        {r.volunteer.firstName} {r.volunteer.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatBrisbane(r.signInAt, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {formatBrisbane(r.signInAt, { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {r.signOutAt ? (
                        <span className="text-gray-600">
                          {formatBrisbane(r.signOutAt, { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          On site
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {r.durationMins != null ? formatDuration(r.durationMins) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {r.location?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditRecord(r)}
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
        </div>
      </div>

      {editRecord && (
        <EditModal
          record={editRecord}
          locations={locations}
          onClose={() => setEditRecord(null)}
        />
      )}
    </>
  )
}
