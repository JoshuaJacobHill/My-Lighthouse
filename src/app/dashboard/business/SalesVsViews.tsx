'use client'

import * as React from 'react'
import type { TrendPoint } from '@/lib/business-reports'

/**
 * Takings against eyeballs, week by week or month by month.
 *
 * Two scales, not one. Dollars and views differ by orders of magnitude, so a
 * shared axis would flatten the smaller series into the floor and say nothing.
 * Each series is drawn against its own maximum, and each gets its own labelled
 * axis — dollars on the left, views on the right — so a bar can be read as a
 * number rather than only compared with its neighbours. The chart is about
 * **shape**: did takings and reach move together?
 *
 * Filtering happens here rather than on the server. Twelve buckets by two
 * shops by two channels is a handful of numbers, and a filter that costs a
 * round trip does not feel like a filter.
 */

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

const num = (n: number) => new Intl.NumberFormat('en-AU').format(n)

/** 0 → "$0", 1234500 → "$12k", 123450000 → "$1.2m" */
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

/**
 * A round number at or above the highest bar.
 *
 * Gridlines at 7,431 would be worse than none — the point of a marker is that
 * you can read it at a glance.
 */
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

type StoreFilter = string | 'all'
type ChannelFilter = 'all' | 'IN_STORE' | 'ONLINE'

const CHANNEL_LABEL: Record<string, string> = {
  IN_STORE: 'In store',
  ONLINE: 'Online',
  CLICK_AND_COLLECT: 'Click & collect',
  HOME_DELIVERY: 'Home delivery',
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

export function SalesVsViews({ points, grain }: { points: TrendPoint[]; grain: 'week' | 'month' }) {
  const [store, setStore] = React.useState<StoreFilter>('all')
  const [channel, setChannel] = React.useState<ChannelFilter>('all')
  const [hover, setHover] = React.useState<number | null>(null)

  const stores = React.useMemo(
    () => [...new Set(points.flatMap((p) => p.sales.map((s) => s.store)))].sort(),
    [points],
  )
  const channels = React.useMemo(
    () => [...new Set(points.flatMap((p) => p.sales.map((s) => s.channel)))].sort(),
    [points],
  )

  const series = React.useMemo(
    () =>
      points.map((p) => ({
        ...p,
        revenueCents: p.sales
          .filter((s) => (store === 'all' || s.store === store) && (channel === 'all' || s.channel === channel))
          .reduce((n, s) => n + s.revenueCents, 0),
      })),
    [points, store, channel],
  )

  const maxRevenue = niceCeiling(Math.max(...series.map((p) => p.revenueCents), 0))
  const maxViews = niceCeiling(Math.max(...series.map((p) => p.views), 0))
  const totalSales = series.reduce((n, p) => n + p.revenueCents, 0)
  const totalViews = series.reduce((n, p) => n + p.views, 0)
  const anything = series.some((p) => p.revenueCents > 0 || p.views > 0)

  const shown = hover !== null ? series[hover] : null
  // The bucket's own length. Dividing February by 30 would be quietly wrong.
  const perDay = shown ? Math.max(shown.days, 1) : 1

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills
          value={store}
          onChange={setStore}
          options={[
            { value: 'all' as StoreFilter, label: 'All shops' },
            ...stores.map((s) => ({ value: s as StoreFilter, label: s })),
          ]}
        />
        <Pills
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'all' as ChannelFilter, label: 'All sales' },
            ...channels.map((c) => ({
              value: c as ChannelFilter,
              label: CHANNEL_LABEL[c] ?? c,
            })),
          ]}
        />
      </div>

      {/* Either the hovered bucket, or the totals. One line, so the numbers do
          not jump around as the pointer moves. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span className="flex items-baseline gap-2">
          <span className="inline-block h-3 w-3 translate-y-px rounded-sm bg-neutral-900" aria-hidden="true" />
          <span className="text-lg font-extrabold text-neutral-900">
            {money(shown ? shown.revenueCents : totalSales)}
          </span>
          <span className="text-neutral-500">
            {shown ? `· ${money(Math.round(shown.revenueCents / perDay))} a day` : 'sales'}
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="inline-block h-3 w-3 translate-y-px rounded-sm bg-orange-500" aria-hidden="true" />
          <span className="text-lg font-extrabold text-neutral-900">
            {num(shown ? shown.views : totalViews)}
          </span>
          <span className="text-neutral-500">
            {shown ? `· ${num(Math.round(shown.views / perDay))} a day` : 'views'}
          </span>
        </span>
        <span className="text-neutral-400">{shown ? shown.title : `last 12 ${grain}s`}</span>
      </div>

      {!anything ? (
        <p className="mt-4 text-sm text-neutral-500">
          Nothing to chart for this selection yet.
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          {/* Left axis: dollars */}
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
            <div style={{ minWidth: points.length * 44 }}>
              <div className="relative" style={{ height: CHART_H }}>
                {/* Markers, so a bar can be read as a number. */}
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

                <div className="absolute inset-0 flex items-end gap-2">
                  {series.map((p, i) => (
                    <div
                      key={p.title}
                      className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center gap-1"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover((h) => (h === i ? null : h))}
                      // Tap as well as hover: a phone has no pointer, and
                      // hover-only detail is detail a phone user never sees.
                      onClick={() => setHover((h) => (h === i ? null : i))}
                      tabIndex={0}
                      role="button"
                      aria-label={`${p.title}: ${money(p.revenueCents)}, ${num(p.views)} views`}
                      // The native tooltip as a fallback for touch and for
                      // anyone who never hovers.
                      title={`${p.title}\n${money(p.revenueCents)} · ${num(p.views)} views`}
                    >
                      <div
                        className={
                          'w-1/2 max-w-[16px] rounded-t transition-colors ' +
                          (hover === i ? 'bg-black' : 'bg-neutral-900')
                        }
                        style={{
                          height: `${(p.revenueCents / maxRevenue) * CHART_H}px`,
                          minHeight: p.revenueCents > 0 ? 2 : 0,
                        }}
                      />
                      <div
                        className={
                          'w-1/2 max-w-[16px] rounded-t transition-colors ' +
                          (hover === i ? 'bg-orange-600' : 'bg-orange-500')
                        }
                        style={{
                          height: `${(p.views / maxViews) * CHART_H}px`,
                          minHeight: p.views > 0 ? 2 : 0,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-1.5 flex gap-2">
                {series.map((p, i) => (
                  <span
                    key={p.title}
                    className={
                      'min-w-0 flex-1 truncate text-center text-[11px] ' +
                      (hover === i ? 'font-semibold text-neutral-900' : 'text-neutral-500')
                    }
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right axis: views */}
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
        {store !== 'all' &&
          ' Views stay organisation-wide: Meta and Mailchimp cannot tell which shop an impression belonged to, so only the sales figure is filtered.'}
      </p>
    </div>
  )
}
