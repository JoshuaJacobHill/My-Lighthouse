'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, AlertTriangle, Check } from 'lucide-react'
import {
  createTaskAction,
  deleteTaskAction,
  upsertChecklistItemAction,
  setChecklistItemActiveAction,
} from '@/lib/actions/tasks.actions'

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

const WEEKDAYS = [
  { v: 1, l: 'Monday' }, { v: 2, l: 'Tuesday' }, { v: 3, l: 'Wednesday' },
  { v: 4, l: 'Thursday' }, { v: 5, l: 'Friday' }, { v: 6, l: 'Saturday' }, { v: 7, l: 'Sunday' },
]

export interface StaffOption { id: string; label: string }
export interface LocationOption { id: string; name: string }
export interface AdminTaskRow {
  id: string
  title: string
  assignedTo: string | null
  dueLabel: string | null
  overdue: boolean
  status: string
  priority: string
}
export interface AdminChecklistRow {
  id: string
  title: string
  frequency: string
  dueTime: string | null
  weekday: number | null
  dayOfMonth: number | null
  location: string | null
  isActive: boolean
  description: string | null
  locationId: string | null
}

export function TasksAdmin({
  tasks,
  items,
  staff,
  locations,
}: {
  tasks: AdminTaskRow[]
  items: AdminChecklistRow[]
  staff: StaffOption[]
  locations: LocationOption[]
}) {
  const router = useRouter()
  const [openTask, setOpenTask] = React.useState(false)
  const [openItem, setOpenItem] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminChecklistRow | null>(null)
  const [freq, setFreq] = React.useState('DAILY')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function submitTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createTaskAction({
        title: String(fd.get('title') ?? ''),
        description: String(fd.get('description') ?? ''),
        assignedToId: String(fd.get('assignedToId') ?? ''),
        locationId: String(fd.get('locationId') ?? ''),
        dueAt: String(fd.get('dueAt') ?? ''),
        priority: (String(fd.get('priority') ?? 'NORMAL') as 'LOW' | 'NORMAL' | 'HIGH'),
      })
      if (!res.success) return setError(res.error ?? 'Could not create the task.')
      setOpenTask(false)
      router.refresh()
    })
  }

  function submitItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await upsertChecklistItemAction({
        id: editing?.id,
        title: String(fd.get('title') ?? ''),
        description: String(fd.get('description') ?? ''),
        frequency: freq as 'DAILY' | 'WEEKLY' | 'MONTHLY',
        locationId: String(fd.get('locationId') ?? ''),
        dueTime: String(fd.get('dueTime') ?? ''),
        weekday: fd.get('weekday') ? Number(fd.get('weekday')) : undefined,
        dayOfMonth: fd.get('dayOfMonth') ? Number(fd.get('dayOfMonth')) : undefined,
        sortOrder: fd.get('sortOrder') ? Number(fd.get('sortOrder')) : 0,
      })
      if (!res.success) return setError(res.error ?? 'Could not save the item.')
      setOpenItem(false)
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* ── Assigned tasks ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Assigned tasks ({tasks.filter((t) => t.status === 'OPEN').length} open)</h2>
            <p className="text-sm text-gray-500">One-off jobs. Assigning emails the person straight away.</p>
          </div>
          <button
            type="button"
            onClick={() => { setOpenTask((o) => !o); setError(null) }}
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> New task
          </button>
        </div>

        {openTask && (
          <form onSubmit={submitTask} className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
            <input className={`${input} sm:col-span-2`} name="title" placeholder="e.g. Take the cardboard bins out for the truck" required />
            <textarea className={`${input} sm:col-span-2`} name="description" rows={2} placeholder="Short description (optional)" />
            <select className={input} name="assignedToId" defaultValue="">
              <option value="">Anyone on shift</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select className={input} name="locationId" defaultValue="">
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <label className="text-xs font-medium text-gray-600">Due (optional)
              <input className={`mt-1 ${input}`} type="datetime-local" name="dueAt" />
            </label>
            <label className="text-xs font-medium text-gray-600">Priority
              <select className={`mt-1 ${input}`} name="priority" defaultValue="NORMAL">
                <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={pending} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
                {pending ? 'Creating…' : 'Create & notify'}
              </button>
            </div>
          </form>
        )}

        {tasks.length > 0 && (
          <ul className="mt-5 divide-y divide-gray-100">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' + (t.status === 'DONE' ? 'bg-green-600 text-white' : 'border-2 border-gray-300')}>
                  {t.status === 'DONE' && <Check className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={'font-medium ' + (t.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                    {t.title}
                    {t.priority === 'HIGH' && t.status !== 'DONE' && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase text-red-700">High</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.assignedTo ?? 'Anyone on shift'}
                    {t.dueLabel && (
                      <span className={t.overdue && t.status !== 'DONE' ? 'font-semibold text-red-600' : ''}>
                        {' · '}{t.overdue && t.status !== 'DONE' ? 'Overdue ' : 'Due '}{t.dueLabel}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm('Delete this task?')) return
                    startTransition(async () => { await deleteTaskAction(t.id); router.refresh() })
                  }}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Recurring checklists ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Recurring checklists</h2>
            <p className="text-sm text-gray-500">
              Cleaning &amp; maintenance the whole team shares. Staff get chased if one goes past its deadline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setOpenItem(true); setEditing(null); setFreq('DAILY'); setError(null) }}
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> New item
          </button>
        </div>

        {openItem && (
          <form onSubmit={submitItem} className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
            <input className={`${input} sm:col-span-2`} name="title" defaultValue={editing?.title} placeholder="e.g. Clean the lunch room" required />
            <textarea className={`${input} sm:col-span-2`} name="description" rows={2} defaultValue={editing?.description ?? ''} placeholder="What does 'done' look like? (optional)" />
            <label className="text-xs font-medium text-gray-600">How often
              <select className={`mt-1 ${input}`} value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">Deadline (time)
              <input className={`mt-1 ${input}`} type="time" name="dueTime" defaultValue={editing?.dueTime ?? ''} />
            </label>
            {freq === 'WEEKLY' && (
              <label className="text-xs font-medium text-gray-600">By which day
                <select className={`mt-1 ${input}`} name="weekday" defaultValue={String(editing?.weekday ?? 7)}>
                  {WEEKDAYS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </label>
            )}
            {freq === 'MONTHLY' && (
              <label className="text-xs font-medium text-gray-600">By which date
                <input className={`mt-1 ${input}`} type="number" min="1" max="31" name="dayOfMonth" defaultValue={editing?.dayOfMonth ?? ''} placeholder="Last day if blank" />
              </label>
            )}
            <select className={input} name="locationId" defaultValue={editing?.locationId ?? ''}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input className={input} type="number" name="sortOrder" placeholder="Order (0)" defaultValue={0} />
            <div className="flex items-center gap-2 sm:col-span-2">
              <button type="submit" disabled={pending} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
                {pending ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
              </button>
              <button type="button" onClick={() => { setOpenItem(false); setEditing(null) }} className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </form>
        )}

        {items.length > 0 && (
          <ul className="mt-5 divide-y divide-gray-100">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase text-gray-600">
                  {i.frequency.toLowerCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={'font-medium ' + (i.isActive ? 'text-gray-900' : 'text-gray-400')}>{i.title}</p>
                  <p className="text-xs text-gray-500">
                    {i.dueTime ? `by ${i.dueTime}` : 'no deadline'}
                    {i.frequency === 'WEEKLY' && i.weekday ? ` · ${WEEKDAYS.find((w) => w.v === i.weekday)?.l}` : ''}
                    {i.frequency === 'MONTHLY' && i.dayOfMonth ? ` · day ${i.dayOfMonth}` : ''}
                    {i.location ? ` · ${i.location}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => { setEditing(i); setFreq(i.frequency); setOpenItem(true) }} className="text-sm font-medium text-orange-600 hover:underline">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => startTransition(async () => { await setChecklistItemActiveAction(i.id, !i.isActive); router.refresh() })}
                  className="text-sm font-medium text-gray-500 hover:underline"
                >
                  {i.isActive ? 'Disable' : 'Enable'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
