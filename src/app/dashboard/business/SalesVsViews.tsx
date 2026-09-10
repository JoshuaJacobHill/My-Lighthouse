'use client'

import * as React from 'react'
import type { TrendDay } from '@/lib/business-reports'
import { SOURCE_LABEL, VIEW_SOURCES, type ViewSource } from '@/lib/view-sources'

/**
 * Takings against eyeballs, over days, weeks or months.
 *
 * The grain belongs to the reader. An earlier version inferred it from the
 * period tabs above — day or week showed twelve weeks, month or year showed
 * twelve months — which was defensible and confusing: choosing "Today" and
 * being shown three months is not what anyone means. Now the chart says what
 * it is showing and lets you change it, and the period tabs only govern the
 * figures around it.
 *
 * Two scales, not one. Dollars and views differ by orders of magnitude, so a
 * shared axis would flatten views into the floor and say nothing. Each gets
 * its own labelled axis, so a bar reads as a number rather than only as taller
 * than its neighbour. The chart is about **shape**: did takings and reach move
 * together?
 *
 * A year of daily figures arrives once and every grain is derived here, which
 * is why switching is instant and filtering costs nothing.
 */

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

const num = (n: number) => new Intl.NumberFormat('en-AU').format(n)

function shortMoney(cents: number): string {
  const d = cents / 100
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}m`
  if (d >= 1000) return `$${Math.round(d / 1000)}k`
  return `$${Math.round(d)}`
}

function shortNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

/** A round number at or above the highest bar — a marker you can read at a glance. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 1.5, 2, 2.5, 5, 10]) {
    if (magnitude * step >= value) return magnitude * step
  }
  return magnitude * 10
}

const CHART_H = 170
const GRID_LINES = 4

export type Grain = 'day' | 'week' | 'month'

/** Seven days at a time on the daily view: a trading week, readable at a glance. */
const DAYS_SHOWN = 7

const CHANNEL_LABEL: Record<string, string> = {
  IN_STORE: 'In store',
  ONLINE: 'Online',
  CLICK_AND_COLLECT: 'Click & collect',
  HOME_DELIVERY: 'Home delivery',
}

type Bucket = { key: string; label: string; title: string; days: number; revenueCents: number; views: number }

/** yyyy-mm-dd → a UTC-midnight Date, which is how calendar days are held here. */
const parse = (day: string) => new Date(`${day}T00:00:00.000Z`)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDay = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

/**
 * Group the daily series.
 *
 * Weeks run Monday to Sunday, as every other week in this app does. Months are
 * calendar months. Buckets are emitted oldest first and only for periods the
 * data covers, so a chart never shows an empty tail it has no figures for.
 */
function bucket(
  daily: TrendDay[],
  grain: Grain,
  storeFilter: string,
  channelFilter: string,
  sources: Set<ViewSource>,
  weeksBack = 0,
): Bucket[] {
  const viewsOf = (d: TrendDay) =>
    VIEW_SOURCES.reduce((n, src) => (sources.has(src) ? n + (d.views[src] ?? 0) : n), 0)

  const revenueOf = (d: TrendDay) =>
    Object.entries(d.sales).reduce((n, [key, cents]) => {
      const [store, channel] = key.split('|')
      const wanted =
        (storeFilter === 'all' || store === storeFilter) &&
        (channelFilter === 'all' || channel === channelFilter)
      return wanted ? n + cents : n
    }, 0)

  const map = new Map<string, Bucket>()

  for (const d of daily) {
    const date = parse(d.day)
    let key: string
    let label: string
    let title: string

    if (grain === 'day') {
      key = d.day
      label = fmtDay(date)
      title = `${fmtDay(date)} ${date.getUTCFullYear()}`
    } else if (grain === 'week') {
      const dow = date.getUTCDay() // 0 = Sunday
      const monday = new Date(date.getTime() - ((dow + 6) % 7) * 86_400_000)
      key = monday.toISOString().slice(0, 10)
      label = fmtDay(monday)
      title = `Week of ${fmtDay(monday)}`
    } else {
      key = d.day.slice(0, 7)
      label = MONTHS[date.getUTCMonth()]
      title = `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    }

    const existing = map.get(key)
    if (existing) {
      existing.revenueCents += revenueOf(d)
      existing.views += viewsOf(d)
      existing.days++
    } else {
      map.set(key, { key, label, title, days: 1, revenueCents: revenueOf(d), views: viewsOf(d) })
    }
  }

  const ordered = [...map.values()].sort((a, b) => a.key.localeCompare(b.key))

  // The daily view is a window that can be walked back a week at a time; the
  // others always show the most recent twelve.
  if (grain === 'day') {
    const end = ordered.length - weeksBack * DAYS_SHOWN
    return ordered.slice(Math.max(0, end - DAYS_SHOWN), Math.max(0, end))
  }
  return ordered.slice(-12)
}

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors ' +
            (o.value === value
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
          }
          aria-pressed={o.value === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SalesVsViews({
  daily,
  defaultGrain,
}: {
  daily: TrendDay[]
  defaultGrain: Grain
}) {
  const [grain, setGrain] = React.useState<Grain>(defaultGrain)
  const [store, setStore] = React.useState('all')
  const [channel, setChannel] = React.useState('all')
  const [picked, setPicked] = React.useState<string | null>(null)
  const [sources, setSources] = React.useState<Set<ViewSource>>(() => new Set(VIEW_SOURCES))
  /** How many weeks back the daily window sits. 0 is the most recent week. */
  const [weeksBack, setWeeksBack] = React.useState(0)

  /** Only the sources that ever have a figure — an empty tick box is clutter. */
  const available = React.useMemo(
    () => VIEW_SOURCES.filter((src) => daily.some((d) => (d.views[src] ?? 0) > 0)),
    [daily],
  )

  const stores = React.useMemo(
    () =>
      [
        ...new Set(daily.flatMap((d) => Object.keys(d.sales).map((k) => k.split('|')[0]))),
      ].sort(),
    [daily],
  )
  const channels = React.useMemo(
    () =>
      [
        ...new Set(daily.flatMap((d) => Object.keys(d.sales).map((k) => k.split('|')[1]))),
      ].sort(),
    [daily],
  )

  const buckets = React.useMemo(
    () => bucket(daily, grain, store, channel, sources, weeksBack),
    [daily, grain, store, channel, sources, weeksBack],
  )

  /** How far back the data goes, so Older can be disabled at the end. */
  const maxWeeksBack = Math.max(0, Math.floor(daily.length / DAYS_SHOWN) - 1)

  // What the chart is showing, in words. On the daily view that is the actual
  // dates in the window rather than "last 7 days", which would be a lie as
  // soon as you stepped backwards.
  const rangeLabel =
    grain === 'day'
      ? buckets.length > 0
        ? `${buckets[0].label} – ${buckets[buckets.length - 1].label}`
        : 'no days'
      : grain === 'week'
        ? 'Last 12 weeks'
        : 'Last 12 months'

  const maxRevenue = niceCeiling(Math.max(...buckets.map((b) => b.revenueCents), 0))
  const maxViews = niceCeiling(Math.max(...buckets.map((b) => b.views), 0))
  const totalSales = buckets.reduce((n, b) => n + b.revenueCents, 0)
  const totalViews = buckets.reduce((n, b) => n + b.views, 0)
  const anything = buckets.some((b) => b.revenueCents > 0 || b.views > 0)

  const shown = buckets.find((b) => b.key === picked) ?? null
  const perDay = shown ? Math.max(shown.days, 1) : 1

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills
          value={grain}
          onChange={(g) => {
            setGrain(g)
            setPicked(null)
            setWeeksBack(0)
          }}
          options={[
            { value: 'day' as Grain, label: 'Days' },
            { value: 'week' as Grain, label: 'Weeks' },
            { value: 'month' as Grain, label: 'Months' },
          ]}
        />
        <div className="flex items-center gap-2">
          {/* Only the daily view is a window you can walk; twelve weeks and
              twelve months already reach back further than the data does. */}
          {grain === 'day' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setWeeksBack((w) => Math.min(w + 1, maxWeeksBack))
                  setPicked(null)
                }}
                disabled={weeksBack >= maxWeeksBack}
                className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-30"
                aria-label="Earlier week"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => {
                  setWeeksBack((w) => Math.max(w - 1, 0))
                  setPicked(null)
                }}
                disabled={weeksBack === 0}
                className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-30"
                aria-label="Later week"
              >
                ›
              </button>
            </div>
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {rangeLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Pills
          value={store}
          onChange={setStore}
          options={[{ value: 'all', label: 'All shops' }, ...stores.map((s) => ({ value: s, label: s }))]}
        />
        <Pills
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'all', label: 'All sales' },
            ...channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] ?? c })),
          ]}
        />
      </div>

      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Views from
          </span>
          {available.map((src) => (
            <label key={src} className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={sources.has(src)}
                onChange={(e) =>
                  setSources((prev) => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(src)
                    else next.delete(src)
                    return next
                  })
                }
                className="h-3.5 w-3.5 rounded border-neutral-300 text-orange-500 focus:ring-orange-500"
              />
              {SOURCE_LABEL[src]}
            </label>
          ))}
        </div>
      )}

      {/* The selected bar, or the totals. One line, so nothing jumps about. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span className="flex items-baseline gap-2">
          <span className="inline-block h-3 w-3 translate-y-px rounded-sm bg-neutral-900" aria-hidden="true" />
          <span className="text-lg font-extrabold text-neutral-900">
            {money(shown ? shown.revenueCents : totalSales)}
          </span>
          <span className="text-neutral-500">
            {shown && grain !== 'day'
              ? `· ${money(Math.round(shown.revenueCents / perDay))} a day`
              : 'sales'}
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="inline-block h-3 w-3 translate-y-px rounded-sm bg-orange-500" aria-hidden="true" />
          <span className="text-lg font-extrabold text-neutral-900">
            {num(shown ? shown.views : totalViews)}
          </span>
          <span className="text-neutral-500">
            {shown && grain !== 'day' ? `· ${num(Math.round(shown.views / perDay))} a day` : 'views'}
          </span>
        </span>
        <span className="text-neutral-400">{shown ? shown.title : rangeLabel.toLowerCase()}</span>
      </div>

      {!anything ? (
        <p className="mt-4 text-sm text-neutral-500">Nothing to chart for this selection yet.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <div
            className="relative w-12 shrink-0 text-right text-[10px] text-neutral-400"
            style={{ height: CHART_H }}
            aria-hidden="true"
          >
            {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${(i / GRID_LINES) * 100}%` }}
              >
                {shortMoney((maxRevenue * (GRID_LINES - i)) / GRID_LINES)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div style={{ minWidth: buckets.length * 44 }}>
              <div className="relative" style={{ height: CHART_H }}>
                {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
                  <div
                    key={i}
                    className={
                      'absolute inset-x-0 border-t ' +
                      (i === GRID_LINES ? 'border-neutral-300' : 'border-neutral-100')
                    }
                    style={{ top: `${(i / GRID_LINES) * 100}%` }}
                    aria-hidden="true"
                  />
                ))}

                <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
                  {buckets.map((b) => (
                    <div
                      key={b.key}
                      className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center gap-0.5 sm:gap-1"
                      onMouseEnter={() => setPicked(b.key)}
                      onMouseLeave={() => setPicked((p) => (p === b.key ? null : p))}
                      onFocus={() => setPicked(b.key)}
                      onBlur={() => setPicked((p) => (p === b.key ? null : p))}
                      // Tap as well as hover: a phone has no pointer, and
                      // hover-only detail is detail a phone user never sees.
                      onClick={() => setPicked((p) => (p === b.key ? null : b.key))}
                      tabIndex={0}
                      role="button"
                      aria-label={`${b.title}: ${money(b.revenueCents)}, ${num(b.views)} views`}
                      title={`${b.title}\n${money(b.revenueCents)} · ${num(b.views)} views`}
                    >
                      <div
                        className={
                          'w-1/2 max-w-[16px] rounded-t transition-colors ' +
                          (picked === b.key ? 'bg-black' : 'bg-neutral-900')
                        }
                        style={{
                          height: `${(b.revenueCents / maxRevenue) * CHART_H}px`,
                          minHeight: b.revenueCents > 0 ? 2 : 0,
                        }}
                      />
                      <div
                        className={
                          'w-1/2 max-w-[16px] rounded-t transition-colors ' +
                          (picked === b.key ? 'bg-orange-600' : 'bg-orange-500')
                        }
                        style={{
                          height: `${(b.views / maxViews) * CHART_H}px`,
                          minHeight: b.views > 0 ? 2 : 0,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-1.5 flex gap-1 sm:gap-2">
                {buckets.map((b) => (
                  <span
                    key={b.key}
                    className={
                      'min-w-0 flex-1 truncate text-center text-[10px] sm:text-[11px] ' +
                      (picked === b.key ? 'font-semibold text-neutral-900' : 'text-neutral-500')
                    }
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            className="relative w-10 shrink-0 text-left text-[10px] text-orange-400"
            style={{ height: CHART_H }}
            aria-hidden="true"
          >
            {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute left-0 -translate-y-1/2"
                style={{ top: `${(i / GRID_LINES) * 100}%` }}
              >
                {shortNum(Math.round((maxViews * (GRID_LINES - i)) / GRID_LINES))}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-neutral-400">
        Dollars read off the left axis, views off the right — two scales, because a dollar and a
        view are not comparable quantities. The bars show whether takings and reach moved together.
        Email counts opens, not the size of the list: a campaign sent to forty thousand people and
        opened by two thousand reached two thousand.
        {store !== 'all' &&
          ' Views stay organisation-wide: Meta and Mailchimp cannot tell which shop an impression belonged to, so only the sales figure is filtered.'}
      </p>
    </div>
  )
}
