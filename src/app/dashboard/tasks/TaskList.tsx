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

export interface PeriodHeadings {
  DAILY: { title: string; remaining: string | null }
  WEEKLY: { title: string; remaining: string | null }
  MONTHLY: { title: string; remaining: string | null }
}

export interface ChecklistRow {
  id: string
  area: string | null
  section: string | null
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
  headings,
  commentsByTask = {},
}: {
  tasks: TaskRow[]
  checklist: ChecklistRow[]
  /** Computed on the server so the date is Brisbane's, not the device's. */
  headings: PeriodHeadings
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

  // Two levels of tabs. 289 items will not be worked through as one page, and
  // stacking three frequencies meant scrolling past 54 daily items to reach
  // anything weekly.
  const areas = React.useMemo(
    () => [...new Set(checklist.map((c) => c.area).filter((a): a is string => Boolean(a)))],
    [checklist],
  )

  // Remembered per device: most people work in one area and should not have to
  // choose on every visit. Read as initial state, so the wrong list never
  // flashes up first.
  const [pickedArea, setPickedArea] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem('lh.checklist.area') || null
    } catch {
      return null
    }
  })
  const area = pickedArea && areas.includes(pickedArea) ? pickedArea : areas[0] ?? null

  const [freq, setFreq] = React.useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY')

  function pickArea(next: string) {
    setPickedArea(next)
    try {
      window.localStorage.setItem('lh.checklist.area', next)
    } catch {
      // storage blocked; the choice just will not persist
    }
  }

  const inArea = React.useMemo(
    () => (area ? checklist.filter((c) => c.area === area) : checklist),
    [checklist, area],
  )

  const FREQS = [
    { key: 'DAILY' as const, label: 'Daily' },
    { key: 'WEEKLY' as const, label: 'Weekly' },
    { key: 'MONTHLY' as const, label: 'Monthly' },
  ].map((f) => {
    const items = inArea.filter((c) => c.frequency === f.key)
    return { ...f, items, done: items.filter((c) => c.done).length }
  })

  const shown = FREQS.find((f) => f.key === freq) ?? FREQS[0]

  // Sections in the order the seed laid them out, which is the order someone
  // actually works through them.
  const sections = React.useMemo(() => {
    const out: { name: string; items: ChecklistRow[] }[] = []
    for (const item of shown?.items ?? []) {
      const name = item.section ?? 'Other'
      const last = out[out.length - 1]
      if (last && last.name === name) last.items.push(item)
      else out.push({ name, items: [item] })
    }
    return out
  }, [shown])

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
      <section>
        <h2 className="text-xl font-bold tracking-tight">Checklists</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Shared by the whole team — whoever does it, ticks it.
        </p>

        {areas.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => pickArea(a)}
                className={
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                  (area === a
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 text-neutral-500 hover:text-neutral-800')
                }
              >
                {a}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex rounded-full border border-neutral-200 p-0.5">
          {FREQS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFreq(f.key)}
              disabled={f.items.length === 0}
              className={
                'flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ' +
                (freq === f.key ? 'bg-orange-600 text-white' : 'text-neutral-500 hover:text-neutral-800')
              }
            >
              {f.label}
              {f.items.length > 0 && (
                <span className={freq === f.key ? 'text-white/70' : 'text-neutral-400'}>
                  {' '}
                  {f.done}/{f.items.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-2xl font-extrabold tracking-tight">{headings[freq].title}</h3>
          {headings[freq].remaining && (
            <span className="text-lg font-semibold text-neutral-400">
              {headings[freq].remaining}
            </span>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="mt-4 rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
            Nothing on this list.
          </p>
        ) : (
          sections.map((sec) => (
            <div key={sec.name} className="mt-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                  {sec.name}
                </h3>
                <span className="text-xs text-neutral-400">
                  {sec.items.filter((c) => c.done).length}/{sec.items.length}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
                {sec.items.map((c) => (
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
            </div>
          ))
        )}
      </section>
    </div>
  )
}