'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, Pencil, X, AlertCircle } from 'lucide-react'
import {
  createWellbeingSessionAction,
  updateWellbeingSessionAction,
  deleteWellbeingSessionAction,
} from '@/lib/actions/wellbeing.actions'

export interface SessionRow {
  id: string
  title: string
  weekday: number
  startTime: string
  endTime: string | null
  location: string | null
  leader: string | null
  notes: string | null
  isActive: boolean
}

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const BLANK = {
  title: '',
  weekday: 2,
  startTime: '08:00',
  endTime: '',
  location: '',
  leader: '',
  notes: '',
  isActive: true,
}
type Draft = typeof BLANK

const field =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none'

/** Add, edit and remove the sessions staff see on the challenge page. */
export function ScheduleAdmin({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = React.useState<string | 'new' | null>(null)
  const [draft, setDraft] = React.useState<Draft>(BLANK)
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  function openNew() {
    setDraft(BLANK)
    setError('')
    setEditing('new')
  }

  function openEdit(s: SessionRow) {
    setDraft({
      title: s.title,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime ?? '',
      location: s.location ?? '',
      leader: s.leader ?? '',
      notes: s.notes ?? '',
      isActive: s.isActive,
    })
    setError('')
    setEditing(s.id)
  }

  function save() {
    setError('')
    startTransition(async () => {
      const res =
        editing === 'new'
          ? await createWellbeingSessionAction(draft)
          : await updateWellbeingSessionAction(editing as string, draft)
      if (!res.success) return setError(res.error ?? 'Could not save that.')
      setEditing(null)
      router.refresh()
    })
  }

  function remove(id: string, title: string) {
    if (!window.confirm(`Remove "${title}" from the schedule?`)) return
    setError('')
    startTransition(async () => {
      const res = await deleteWellbeingSessionAction(id)
      if (!res.success) return setError(res.error ?? 'Could not remove that.')
      router.refresh()
    })
  }

  const byDay = DAYS.map((_, i) => ({ weekday: i, list: sessions.filter((s) => s.weekday === i) })).filter(
    (d) => d.list.length > 0
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          These show on the staff challenge page under &ldquo;This week&rdquo;, with the date worked out for you.
        </p>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add a session
        </button>
      </div>

      {error && (
        <p className="mt-4 inline-flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      {sessions.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Nothing scheduled yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {byDay.map(({ weekday, list }) => (
            <div key={weekday}>
              <h3 className="text-sm font-bold text-gray-900">{DAYS[weekday]}</h3>
              <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-200">
                {list.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">
                        {s.title}
                        {!s.isActive && (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Hidden
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {s.startTime}
                        {s.endTime ? ` to ${s.endTime}` : ''}
                        {s.location ? ` at ${s.location}` : ''}
                        {s.leader ? `, with ${s.leader}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      aria-label={`Edit ${s.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s.id, s.title)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${s.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-lg rounded-t-3xl bg-white sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="font-bold text-gray-900">{editing === 'new' ? 'Add a session' : 'Edit session'}</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
              <label className="block text-sm font-medium text-gray-700">
                What is it
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Run around the block"
                  className={`mt-1 ${field}`}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium text-gray-700">
                  Day
                  <select
                    value={draft.weekday}
                    onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}
                    className={`mt-1 bg-white ${field}`}
                  >
                    {DAYS.slice(1).map((d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Starts
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                    className={`mt-1 ${field}`}
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Ends
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                    className={`mt-1 ${field}`}
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Where
                <input
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  placeholder="Loganholme store"
                  className={`mt-1 ${field}`}
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Add one session per location if the two stores are doing different things.
                </span>
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Who is leading it
                <input
                  value={draft.leader}
                  onChange={(e) => setDraft({ ...draft, leader: e.target.value })}
                  placeholder="Optional"
                  className={`mt-1 ${field}`}
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Anything else
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  placeholder="Shown when someone taps the session. Optional."
                  className={`mt-1 ${field}`}
                />
              </label>

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Show this to staff</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
