'use client'

import * as React from 'react'
import { Check, Clock, AlertTriangle, MapPin } from 'lucide-react'
import { setTaskStatusAction, toggleChecklistAction } from '@/lib/actions/tasks.actions'

export interface TaskRow {
  id: string
  title: string
  description: string | null
  priority: string
  dueLabel: string | null
  overdue: boolean
  location: string | null
  assignedTo: string | null
  done: boolean
}

export interface ChecklistRow {
  id: string
  title: string
  description: string | null
  frequency: string
  periodLabel: string
  dueTime: string | null
  location: string | null
  done: boolean
  overdue: boolean
  doneBy: string | null
}

function Tick({ done, onToggle, pending }: { done: boolean; onToggle: () => void; pending: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={done}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      className={
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ' +
        (done ? 'border-green-600 bg-green-600 text-white' : 'border-neutral-300 hover:border-orange-500')
      }
    >
      {done && <Check className="h-4 w-4" />}
    </button>
  )
}

export function TaskList({ tasks, checklist }: { tasks: TaskRow[]; checklist: ChecklistRow[] }) {
  const [pending, startTransition] = React.useTransition()

  const groups = [
    { key: 'DAILY', label: 'Daily' },
    { key: 'WEEKLY', label: 'Weekly' },
    { key: 'MONTHLY', label: 'Monthly' },
  ].map((g) => ({ ...g, items: checklist.filter((c) => c.frequency === g.key) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-8">
      {/* Assigned tasks */}
      <section>
        <h2 className="text-xl font-bold tracking-tight">My tasks</h2>
        {tasks.length === 0 ? (
          <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
            Nothing assigned right now. Nice.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-4 p-4">
                <Tick
                  done={t.done}
                  pending={pending}
                  onToggle={() =>
                    // The action revalidates /dashboard/tasks, so Next returns
                    // the re-rendered page in the action's own response. Asking
                    // the router to refresh as well rendered the whole page a
                    // second time, in series, on every single tick.
                    startTransition(async () => {
                      await setTaskStatusAction(t.id, !t.done)
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className={'font-semibold ' + (t.done ? 'text-neutral-400 line-through' : 'text-neutral-900')}>
                    {t.title}
                    {t.priority === 'HIGH' && !t.done && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase text-red-700">
                        High
                      </span>
                    )}
                  </p>
                  {t.description && <p className="mt-0.5 text-sm text-neutral-600">{t.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {t.dueLabel && (
                      <span className={'inline-flex items-center gap-1 ' + (t.overdue && !t.done ? 'font-semibold text-red-600' : '')}>
                        {t.overdue && !t.done ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {t.overdue && !t.done ? `Overdue — ${t.dueLabel}` : `Due ${t.dueLabel}`}
                      </span>
                    )}
                    {t.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {t.location}
                      </span>
                    )}
                    {t.assignedTo && <span>For {t.assignedTo}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recurring checklists */}
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="text-xl font-bold tracking-tight">{g.label} checklist</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Shared by the whole team — whoever does it, ticks it.
          </p>
          <ul className="mt-3 divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
            {g.items.map((c) => (
              <li key={c.id} className="flex items-start gap-4 p-4">
                <Tick
                  done={c.done}
                  pending={pending}
                  onToggle={() =>
                    startTransition(async () => {
                      await toggleChecklistAction(c.id, !c.done)
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className={'font-semibold ' + (c.done ? 'text-neutral-400 line-through' : 'text-neutral-900')}>
                    {c.title}
                  </p>
                  {c.description && <p className="mt-0.5 text-sm text-neutral-600">{c.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {c.done ? (
                      <span className="font-medium text-green-700">
                        Done {c.periodLabel}
                        {c.doneBy ? ` by ${c.doneBy}` : ''}
                      </span>
                    ) : c.overdue ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> Overdue{c.dueTime ? ` (due ${c.dueTime})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Due {c.periodLabel}
                        {c.dueTime ? ` by ${c.dueTime}` : ''}
                      </span>
                    )}
                    {c.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {c.location}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
