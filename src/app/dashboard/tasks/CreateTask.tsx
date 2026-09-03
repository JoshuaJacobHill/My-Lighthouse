'use client'

import * as React from 'react'
import { Plus, Loader2, X } from 'lucide-react'
import { createTaskAction } from '@/lib/actions/tasks.actions'
import { useToast } from '@/components/ui/use-toast'

export interface Assignable {
  id: string
  name: string
}

const FIELD =
  'mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

/**
 * Create and hand out a task without going to the admin panel.
 *
 * Collapsed until asked for: most people opening this page are here to tick
 * things off, not to write new ones, and a form sitting open above their list
 * would push the actual work down the screen.
 */
export function CreateTask({
  staff,
  locations,
}: {
  staff: Assignable[]
  locations: Assignable[]
}) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [assignedToId, setAssignedToId] = React.useState('')
  const [locationId, setLocationId] = React.useState('')
  const [dueAt, setDueAt] = React.useState('')
  const [priority, setPriority] = React.useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL')

  function reset() {
    setTitle('')
    setDescription('')
    setAssignedToId('')
    setLocationId('')
    setDueAt('')
    setPriority('NORMAL')
  }

  async function save() {
    if (!title.trim()) {
      toast.error('Not quite ready', 'Give the task a title.')
      return
    }
    setSaving(true)
    const res = await createTaskAction({
      title,
      description,
      assignedToId,
      locationId,
      dueAt,
      priority,
    })
    setSaving(false)

    if (res.success) {
      const who = staff.find((s) => s.id === assignedToId)?.name
      toast.success(
        'Task created',
        who ? `${who} has been told about it.` : 'Anyone on shift can pick it up.',
      )
      reset()
      setOpen(false)
      // No router.refresh(): the action revalidates this page.
    } else {
      toast.error('Not created', res.error ?? 'Please try again.')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New task
      </button>
    )
  }

  return (
    <div className="space-y-4 rounded-[28px] border border-neutral-200 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold tracking-tight">New task</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <label className="block text-sm font-semibold text-neutral-700">
        What needs doing
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pack shelves"
          className={FIELD}
        />
      </label>

      <label className="block text-sm font-semibold text-neutral-700">
        Any detail
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={FIELD}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-neutral-700">
          Who
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className={FIELD}
          >
            <option value="">Anyone on shift</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-neutral-500">
            {assignedToId ? 'They get a notification and an email.' : 'Nobody is notified.'}
          </span>
        </label>

        <label className="block text-sm font-semibold text-neutral-700">
          Where
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={FIELD}
          >
            <option value="">Anywhere</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-neutral-700">
          Due
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block text-sm font-semibold text-neutral-700">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH')}
            className={FIELD}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Create task
      </button>
    </div>
  )
}
