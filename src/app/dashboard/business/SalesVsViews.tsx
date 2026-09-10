import type { TrendPoint } from '@/lib/business-reports'

/**
 * Takings against eyeballs, week by week or month by month.
 *
 * Two scales, not one. Dollars and views differ by orders of magnitude, so a
 * shared axis would flatten the smaller series into the floor and say nothing.
 * Each series is therefore drawn against its own maximum, which makes the
 * chart about **shape** — did reach and takings move together? — rather than
 * about comparing a dollar to a view, which would be meaningless anyway.
 *
 * Said plainly under the chart, because an unlabelled dual axis is a way of
 * misleading people by accident.
 *
 * Hand-drawn SVG rather than a charting library: it is two rectangles per
 * bucket, and this project keeps its dependencies few.
 */

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

const num = (n: number) => new Intl.NumberFormat('en-AU').format(n)

export function SalesVsViews({ points, grain }: { points: TrendPoint[]; grain: 'week' | 'month' }) {
  const maxRevenue = Math.max(...points.map((p) => p.revenueCents), 1)
  const maxViews = Math.max(...points.map((p) => p.views), 1)
  const hasAnything = points.some((p) => p.revenueCents > 0 || p.views > 0)

  const H = 150
  const totalSales = points.reduce((n, p) => n + p.revenueCents, 0)
  const totalViews = points.reduce((n, p) => n + p.views, 0)

  if (!hasAnything) {
    return (
      <p className="mt-3 text-sm text-neutral-500">
        Nothing to chart yet — no sales or views recorded in this period.
      </p>
    )
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-neutral-900" aria-hidden="true" />
          <span className="font-semibold text-neutral-900">{money(totalSales)}</span>
          <span className="text-neutral-500">sales</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-orange-500" aria-hidden="true" />
          <span className="font-semibold text-neutral-900">{num(totalViews)}</span>
          <span className="text-neutral-500">views</span>
        </span>
      </div>

      {/* Horizontal scroll rather than squeezing twelve months into a phone. */}
      <div className="overflow-x-auto">
        <div className="flex min-w-full items-end gap-2" style={{ minWidth: points.length * 44 }}>
          {points.map((p) => {
            const salesH = Math.round((p.revenueCents / maxRevenue) * H)
            const viewsH = Math.round((p.views / maxViews) * H)
            return (
              <div key={p.title} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-[150px] w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 max-w-[16px] rounded-t bg-neutral-900"
                    style={{ height: `${Math.max(salesH, p.revenueCents > 0 ? 2 : 0)}px` }}
                  >
                    <title>{`${p.title}: ${money(p.revenueCents)}`}</title>
                  </div>
                  <div
                    className="w-1/2 max-w-[16px] rounded-t bg-orange-500"
                    style={{ height: `${Math.max(viewsH, p.views > 0 ? 2 : 0)}px` }}
                  >
                    <title>{`${p.title}: ${num(p.views)} views`}</title>
                  </div>
                </div>
                <span className="truncate text-[11px] text-neutral-500">{p.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-400">
        Each series is scaled to its own highest {grain} — {money(maxRevenue)} and{' '}
        {num(maxViews)} views — so the bars show whether takings and reach moved together, not how a
        dollar compares to a view.
      </p>
    </div>
  )
}
