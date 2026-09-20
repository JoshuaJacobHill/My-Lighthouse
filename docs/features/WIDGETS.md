# Building an interactive widget

How the fitness tracker and the sales/marketing tracker are built. **Copy this
pattern for anything new** — a stock tracker, a Santa's Little Helpers
progress board, an HR leave calendar — so the app keeps looking like one app
rather than a collection of pages built in different months.

Read alongside the Design rule in `AGENTS.md`.

Reference implementations, both worth reading before you start:

- `src/app/dashboard/business/SalesVsViews.tsx` — two series, several filters
- `src/app/dashboard/fitness/StepsChart.tsx` — one series, range switching

## The shape: server fetches, client renders

A widget is a **client component that receives finished data as props**. The
page is a server component; it queries, shapes, and hands over plain values.

```tsx
// page.tsx — server component
const trend = await getDailyTrend(365)
return <SalesVsViews daily={trend} defaultGrain={openingGrain} />
```

```tsx
// SalesVsViews.tsx
'use client'
import type { TrendDay } from '@/lib/business-reports'   //  type, not value
```

Three rules that follow from this, all of which have broken the build here:

1. **Import types with `import type`.** Importing a *value* from a module that
   transitively imports Prisma pulls the database driver into the browser
   bundle and fails with "Can't resolve 'dns'". `tsc` does not catch it; only
   `npm run build` does.
2. **When you need shared constants as values, give them their own module** with
   no server imports. That is exactly why `src/lib/view-sources.ts` exists —
   `VIEW_SOURCES` and `SOURCE_LABEL` were originally in `business-reports.ts`
   and broke the build.
3. **Props must be serialisable.** No Prisma objects, no `Decimal`, no `Date`
   where a string will do. Convert on the server: cents as `number`, days as
   `"yyyy-mm-dd"`.

Fetch **once, at the widest grain**, and let the client switch. `getDailyTrend(365)`
sends a year of days so the chart can offer days, weeks and months and switch
instantly — where fetching per grain meant the page had to guess which one you
wanted, and guessed wrong often enough to be annoying.

## The shell

```tsx
<section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
  <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
    Sales and views
  </h2>
  …
</section>
```

`rounded-[28px]`, a one-pixel `border-neutral-200`, `p-5` (`sm:p-6` where it
needs room). White canvas. Section headings are small, bold, uppercase,
`tracking-wide`, `text-neutral-400` — never large; the numbers are the loud
part, not the label.

## Controls

Filters and ranges are **local `useState`, never URL state**, unless a link to
that exact view needs to be shareable. Switching grain should not cost a
round-trip.

Render them as a pill group: `rounded-full`, the active one filled
`bg-neutral-900 text-white`, the rest `border-neutral-300 text-neutral-600`.
Checkbox filters (which sources to include) as small squared checkboxes with
`accent`-coloured ticks.

Give every widget a sensible **opening state** chosen on the server —
`defaultGrain` — so the first render is the view most people want.

## Drawing

**Bars are divs, not SVG.** Percentage heights inside a fixed-height relative
container:

```tsx
const CHART_H = 170
const GRID_LINES = 4

<div className="relative" style={{ height: CHART_H }}>
  {/* grid lines, absolutely positioned at i / GRID_LINES */}
  <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
    <div style={{ height: `${(b.revenueCents / maxRevenue) * CHART_H}px` }} />
  </div>
</div>
```

Why divs: they take Tailwind classes, hover and click handlers, and transitions
without a second styling system, and they stay legible in both themes. Reach
for SVG only when the shape is not a rectangle.

- **Fixed height constant**, not a viewport unit. A chart that resizes with the
  window makes two screenshots incomparable.
- **Scroll horizontally, never squash.** `overflow-x-auto` on the plot with
  `minWidth: buckets.length * 44`. Twenty bars crammed into a phone width is
  unreadable; twenty bars you can swipe is fine.
- **Axis labels outside the scrolling area** so they stay put.

## Colour

Take colours from the Tailwind scale in classes wherever possible: `orange-500`
for the primary series, the `neutral` scale for chrome and grid.

Where an inline style or a computed fill needs a literal, use a **named
constant at the top of the file**, matching the Tailwind value:

```tsx
const REST     = '#fb923c'   // orange-400 — the ordinary bar
const SELECTED = '#9a3412'   // orange-800 — the one you clicked
const FUTURE   = '#e7e5e4'   // neutral-200 — days that have not happened yet
```

**Render "not yet" differently from "zero".** A future day and a day with no
steps look identical otherwise, and someone reads the chart as a collapse. Same
principle as checking `IngestRun` before calling a number low.

## Numbers

```tsx
const num   = (n: number) => new Intl.NumberFormat('en-AU').format(n)
const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)
```

Australian locale always. **`tabular-nums` wherever digits sit in a column** or
change in place, so they do not jitter. Money arrives as integer cents from the
reporting tables — see `docs/DATA.md`, money is stored two ways.

## Interaction

- **Click to pin a value**, hover to preview. Touch has no hover, so anything
  only reachable by hovering is invisible on the iPad.
- **Selection has a sensible default** — the most recent day with data, not the
  first bar (`initial` in `StepsChart`).
- Offer the underlying table behind a toggle (`showTable`). Somebody always
  wants the numbers, and it costs nothing when the data is already client-side.
- **Say what the number does not mean.** The exposure panel states that paid and
  organic views overlap. A widget that quietly implies more precision than it
  has is worse than one that admits the caveat.

## Before you ship it

```bash
npx tsc --noEmit      # necessary, not sufficient
npx eslint <paths>
npm run build         # the only thing that catches the client/server boundary
```

And the lint rule that has bitten three times: **no synchronous `setState`
inside an effect.** Seed state from props, or set it inside the async callback.
