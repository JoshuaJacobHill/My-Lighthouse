'use client'

import * as React from 'react'
import { Check, Clock, AlertTriangle, MapPin, MessageCircle } from 'lucide-react'
import { CommentThread } from '@/components/comments/CommentThread'
import type { CommentView } from '@/lib/comments'
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

export function TaskList({
  tasks,
  checklist,
  commentsByTask = {},
}: {
  tasks: TaskRow[]
  checklist: ChecklistRow[]
  commentsByTask?: Record<string, CommentView[]>
}) {
  const [pending, startTransition] = React.useTransition()
  const [tab, setTab] = React.useState<'OPEN' | 'DONE'>('OPEN')
  // One thread open at a time: a task row is small, and several expanded at
  // once turns the list into a wall.
  const [openThread, setOpenThread] = React.useState<string | null>(null)

  const openTasks = tasks.filter((t) => !t.done)
  const doneTasks = tasks.filter((t) => t.done)
  const shownTasks = tab === 'OPEN' ? openTasks : doneTasks

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">My tasks</h2>
          {/* Finished work moves out of the way rather than disappearing: still
              there to check, just not in front of what is left to do. */}
          <div className="flex rounded-full border border-neutral-200 p-0.5">
            {(['OPEN', 'DONE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                  (tab === t ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-800')
                }
              >
                {t === 'OPEN' ? `To do${openTasks.length ? ` (${openTasks.length})` : ''}` : 'Completed'}
              </button>
            ))}
          </div>
        </div>
        {shownTasks.length === 0 ? (
          <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
            {tab === 'OPEN' ? 'Nothing assigned right now. Nice.' : 'Nothing completed yet.'}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
            {shownTasks.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-start gap-4">
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
                    <button
                      type="button"
                      onClick={() => setOpenThread((cur) => (cur === t.id ? null : t.id))}
                      aria-expanded={openThread === t.id}
                      className="inline-flex items-center gap-1 font-semibold text-neutral-600 hover:text-neutral-900"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {(commentsByTask[t.id]?.length ?? 0) > 0
                        ? `${commentsByTask[t.id]!.length} comment${commentsByTask[t.id]!.length === 1 ? '' : 's'}`
                        : 'Comment'}
                    </button>
                  </div>
                </div>
                </div>

                {openThread === t.id && (
                  <div className="mt-4 border-t border-neutral-100 pt-4">
                    <CommentThread taskId={t.id} comments={commentsByTask[t.id] ?? []} compact />
                  </div>
                )}
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
