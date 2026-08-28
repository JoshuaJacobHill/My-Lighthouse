'use client'

import * as React from 'react'
import { Clock, MapPin, User, ChevronDown } from 'lucide-react'
import type { ScheduleItem } from '@/lib/fitness-data'

/** "11:30" to "11:30 am" */
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const suffix = h < 12 ? 'am' : 'pm'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`
}

/**
 * This week's sessions, grouped by day and openable for detail.
 *
 * Sessions carry a location because the two stores run different things, so a
 * day can hold several and the location is what tells people which one is
 * theirs. Kept collapsed by default: most people want to know what is on, not
 * read every note.
 */
export function WeekSchedule({ schedule }: { schedule: ScheduleItem[] }) {
  const [open, setOpen] = React.useState<string | null>(schedule.find((s) => s.isToday)?.id ?? null)

  const days = React.useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const s of schedule) {
      const list = map.get(s.date) ?? []
      list.push(s)
      map.set(s.date, list)
    }
    return [...map.entries()]
  }, [schedule])

  if (days.length === 0) {
    return (
      <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight text-neutral-950">This week</h2>
        <p className="mt-2 text-sm text-neutral-500">Nothing scheduled yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-neutral-950">This week</h2>
      <p className="mt-1 text-sm text-neutral-500">Everyone is welcome. Come to whatever suits.</p>

      <div className="mt-5 space-y-5">
        {days.map(([date, items]) => (
          <div key={date}>
            <p className={`text-sm font-bold ${items[0].isToday ? 'text-orange-600' : 'text-neutral-900'}`}>
              {items[0].dateLabel}
              {items[0].isToday && <span className="ml-2 font-semibold text-orange-500">Today</span>}
            </p>

            <ul className="mt-2 space-y-2">
              {items.map((s) => {
                const isOpen = open === s.id
                return (
                  <li key={s.id} className="overflow-hidden rounded-2xl bg-neutral-50">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : s.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-100"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-neutral-900">{s.title}</span>
                        <span className="mt-0.5 block text-sm text-neutral-500">
                          {clock(s.startTime)}
                          {s.endTime && ` to ${clock(s.endTime)}`}
                          {s.location && ` at ${s.location}`}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-neutral-200/70 px-4 py-3">
                        <dl className="space-y-2 text-sm">
                          <div className="flex gap-2.5">
                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                            <dd className="text-neutral-700">
                              {clock(s.startTime)}
                              {s.endTime ? ` to ${clock(s.endTime)}` : ''}, {s.dateLabel}
                            </dd>
                          </div>
                          {s.location && (
                            <div className="flex gap-2.5">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                              <dd className="text-neutral-700">{s.location}</dd>
                            </div>
                          )}
                          {s.leader && (
                            <div className="flex gap-2.5">
                              <User className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                              <dd className="text-neutral-700">Led by {s.leader}</dd>
                            </div>
                          )}
                        </dl>
                        {s.notes && <p className="mt-3 text-sm text-neutral-600">{s.notes}</p>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
