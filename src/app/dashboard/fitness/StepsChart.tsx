'use client'

import * as React from 'react'
import { Trophy, Users, Table2 } from 'lucide-react'
import type { DayPoint } from '@/lib/fitness-data'

/**
 * Daily steps across the challenge — one series, so identity is carried by the
 * axis rather than by colour, and no legend is needed.
 *
 * Bars are HTML rather than SVG on purpose: each column is a real <button>, so
 * the hit target can be the full column height (far bigger than a 10px-wide bar
 * on a phone), and keyboard and screen-reader support come for free.
 *
 * Palette validated against the light surface — rest #fb923c vs selected
 * #9a3412 clears the CVD and normal-vision separation checks. The rest fill sits
 * under 3:1 against white, which obliges exact figures in text: the detail panel
 * and the table view below both provide them.
 */

const REST = '#fb923c'
const SELECTED = '#9a3412'
const FUTURE = '#e7e5e4'

const nf = new Intl.NumberFormat('en-AU')

interface Props {
  days: DayPoint[]
  todayIndex: number
}

export function StepsChart({ days, todayIndex }: Props) {
  // Open on today where possible, otherwise the last day with any steps.
  const initial = React.useMemo(() => {
    if (todayIndex >= 0 && days[todayIndex] && !days[todayIndex].future) return todayIndex
    const walked = days.map((d, i) => (d.total > 0 ? i : -1)).filter((i) => i >= 0)
    return walked.length ? walked[walked.length - 1] : -1
  }, [days, todayIndex])

  const [selected, setSelected] = React.useState(initial)
  const [showTable, setShowTable] = React.useState(false)
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  const max = Math.max(1, ...days.map((d) => d.total))
  const active = selected >= 0 ? days[selected] : null
  const logged = days.filter((d) => !d.future)
  const average = logged.length ? Math.round(logged.reduce((s, d) => s + d.total, 0) / logged.length) : 0

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null
    if (next === null || next < 0 || next >= days.length) return
    e.preventDefault()
    setSelected(next)
    refs.current[next]?.focus()
  }

  return (
    <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold tracking-tight text-neutral-950">Steps each day</h2>
        <p className="text-sm text-neutral-500">
          Averaging <strong className="font-semibold text-neutral-700">{nf.format(average)}</strong> a day
        </p>
      </div>
      <p className="mt-0.5 text-sm text-neutral-500">Tap a day to see who led it.</p>

      {/* ── The bars ── */}
      <div
        className="mt-5 flex h-44 items-end gap-[2px] border-b border-neutral-200"
        role="group"
        aria-label="Steps by day"
      >
        {days.map((d, i) => {
          const height = d.future ? 3 : Math.max(d.total > 0 ? 4 : 2, Math.round((d.total / max) * 100))
          const isSelected = i === selected
          return (
            <button
              key={d.day}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              onClick={() => setSelected(isSelected ? -1 : i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              // The button fills the column, so the tap target is the whole
              // height even when the bar itself is a few pixels tall.
              className="group relative flex h-full flex-1 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              aria-pressed={isSelected}
              aria-label={
                d.future
                  ? `${d.label}, still to come`
                  : `${d.label}, ${nf.format(d.total)} steps${d.leader ? `, most by ${d.leader.name}` : ''}`
              }
            >
              <span
                className="w-full rounded-t-[4px] transition-[background-color,height] duration-200"
                style={{
                  height: `${height}%`,
                  backgroundColor: d.future ? FUTURE : isSelected ? SELECTED : REST,
                }}
              />
              {i === todayIndex && (
                <span className="absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-neutral-900" />
              )}
            </button>
          )
        })}
      </div>

      {/* Only the ends and today are labelled — a number on every bar is noise.
          "Today" is positioned over its own column rather than centred, so it
          points at the bar it actually describes. */}
      <div className="relative mt-3 h-4 text-[11px] font-medium text-neutral-400">
        <span className="absolute left-0">{days[0]?.label}</span>
        {todayIndex > 2 && todayIndex < days.length - 3 && (
          <span
            className="absolute -translate-x-1/2 font-semibold text-neutral-700"
            style={{ left: `${((todayIndex + 0.5) / days.length) * 100}%` }}
          >
            Today
          </span>
        )}
        <span className="absolute right-0">{days[days.length - 1]?.label}</span>
      </div>

      {/* ── The selected day ── */}
      <div className="mt-5 min-h-[104px] rounded-2xl bg-neutral-50 p-4">
        {active ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {active.future ? 'Still to come' : active.label}
            </p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-950">
              {nf.format(active.total)}
              <span className="ml-1.5 text-base font-semibold text-neutral-400">steps</span>
            </p>
            {active.leader ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-orange-500" aria-hidden="true" />
                  <strong className="font-semibold text-neutral-900">{active.leader.name}</strong> led with{' '}
                  {nf.format(active.leader.amount)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                  {active.walkers} {active.walkers === 1 ? 'person' : 'people'}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                {active.future ? 'Not here yet.' : 'Nobody logged steps on this day.'}
              </p>
            )}
          </>
        ) : (
          <p className="pt-6 text-center text-sm text-neutral-500">Tap any day above to see how it went.</p>
        )}
      </div>

      {/* ── Table view — the exact numbers, for anyone the bars don't serve ── */}
      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <Table2 className="h-4 w-4" aria-hidden="true" />
        {showTable ? 'Hide every day' : 'See every day'}
      </button>

      {showTable && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Day</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Steps</th>
                <th scope="col" className="px-4 py-2 font-semibold">Most that day</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => !d.future)
                .map((d) => (
                  <tr key={d.day} className="border-t border-neutral-100">
                    <td className="px-4 py-2 text-neutral-700">{d.label}</td>
                    <td className="px-4 py-2 text-right font-semibold text-neutral-900">{nf.format(d.total)}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {d.leader ? `${d.leader.name} — ${nf.format(d.leader.amount)}` : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
