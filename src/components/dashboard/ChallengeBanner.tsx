import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SmartImage } from '@/components/ui/SmartImage'

/**
 * The September challenge banner on the staff dashboard.
 *
 * The artwork is inline SVG rather than an image file: it stays crisp at any
 * size, adds nothing to page weight, and can't rot the way a hosted image can
 * (the festival hero on the public site is currently a dead CDN link — worth
 * not repeating). Pass an `imageUrl` later and it takes over the backdrop.
 */

interface Props {
  name: string
  /** 0–1. */
  progress: number
  total: number
  goal: number
  daysLeft: number
  started: boolean
  /** "1 September" — shown before kick-off. */
  startLabel: string
  imageUrl?: string | null
}

const nf = new Intl.NumberFormat('en-AU')

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1000)}k`
  return nf.format(n)
}

/** Concentric rings, in the spirit of the Activity app. */
function Rings({ progress }: { progress: number }) {
  // Floored so an early-month 2% still draws as a visible arc rather than
  // three dots that look like a rendering fault. The rings are decorative — the
  // real figure is the number and the bar beside them.
  const arc = (multiplier: number) => Math.min(1, Math.max(progress > 0 ? 0.06 : 0, progress * multiplier))
  const rings = [
    { r: 52, w: 13, colour: '#f97316', fraction: arc(1) },
    { r: 36, w: 13, colour: '#fb923c', fraction: arc(1.35) },
    { r: 20, w: 13, colour: '#fdba74', fraction: arc(1.8) },
  ]
  return (
    <svg viewBox="0 0 140 140" className="h-full w-full" aria-hidden="true">
      <g transform="translate(70 70) rotate(-90)">
        {rings.map((ring) => {
          const circumference = 2 * Math.PI * ring.r
          return (
            <g key={ring.r}>
              <circle r={ring.r} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={ring.w} />
              {/* A rounded cap on a zero-length dash still paints a dot, so an
                  empty ring is drawn as no arc at all. */}
              {ring.fraction > 0 && (
                <circle
                  r={ring.r}
                  fill="none"
                  stroke={ring.colour}
                  strokeWidth={ring.w}
                  strokeLinecap="round"
                  strokeDasharray={`${circumference * ring.fraction} ${circumference}`}
                />
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export function ChallengeBanner({ name, progress, total, goal, daysLeft, started, startLabel, imageUrl }: Props) {
  const pct = Math.round(progress * 100)

  // ── Designed artwork ──
  //
  // The headline, dates and call to action are part of the image, so nothing is
  // drawn on top of it — an overlay would only repeat what the design already
  // says, and would land in a different place on every screen size. Height is
  // left to the image's own ratio so the baked-in text never gets cropped.
  if (imageUrl) {
    return (
      <Link
        href="/dashboard/fitness"
        className="group block overflow-hidden rounded-[28px] bg-neutral-950 shadow-sm transition-transform active:scale-[0.995]"
      >
        <SmartImage
          src={imageUrl}
          alt={`${name} — ${started ? 'view the challenge' : `starts ${startLabel}`}`}
          width={1600}
          height={867}
          sizes="(max-width: 1024px) 100vw, 960px"
          priority
          className="block h-auto w-full"
        />

        {/* A bar beneath the artwork rather than over it: the design has no
            call to action of its own, and this way nothing ever covers it. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-white sm:px-6">
          {started ? (
            <>
              <span className="text-sm font-bold">
                {compact(total)} <span className="font-medium text-white/60">of {compact(goal)} steps</span>
              </span>
              <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
                  style={{ width: `${Math.max(pct, total > 0 ? 1.5 : 0)}%` }}
                />
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                Log your steps
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </>
          ) : (
            <>
              <span className="text-sm text-white/70">
                {compact(goal)} steps together
                {daysLeft > 0 && ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go`}
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold">
                See the challenge
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </>
          )}
        </div>
      </Link>
    )
  }

  // ── Fallback artwork, for when no banner has been supplied ──
  return (
    <Link
      href="/dashboard/fitness"
      className="group relative block overflow-hidden rounded-[28px] bg-neutral-950 text-white shadow-sm transition-transform active:scale-[0.995]"
    >
      {/* A warm wash so the rings sit on something, image or not. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(95% 120% at 86% 22%, rgba(249,115,22,0.62) 0%, rgba(234,88,12,0.18) 45%, transparent 72%)',
        }}
      />

      <div className="relative flex items-center gap-4 p-6 sm:gap-6 sm:p-7">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-300">Staff challenge</p>
          <h2 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{name}</h2>
          <p className="mt-1.5 text-sm text-white/70">
            {started ? (
              <>
                <strong className="font-semibold text-white">{compact(total)}</strong> of {compact(goal)} steps
                together
                {daysLeft > 0 && (
                  <>
                    {' '}
                    &middot; {daysLeft} {daysLeft === 1 ? 'day' : 'days'} to go
                  </>
                )}
              </>
            ) : (
              <>
                <strong className="font-semibold text-white">Starts {startLabel}</strong> &middot; {compact(goal)}{' '}
                steps together
                {daysLeft > 0 && (
                  <>
                    {' '}
                    &middot; {daysLeft} {daysLeft === 1 ? 'day' : 'days'} to go
                  </>
                )}
              </>
            )}
          </p>

          <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
              style={{ width: `${Math.max(pct, started ? 1.5 : 0)}%` }}
            />
          </div>

          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white">
            {started ? 'Log your steps' : 'See the challenge'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>

        <div className="h-24 w-24 shrink-0 sm:h-32 sm:w-32">
          <Rings progress={progress} />
        </div>
      </div>
    </Link>
  )
}
