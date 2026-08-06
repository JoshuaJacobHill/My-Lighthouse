'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'

export interface AppealItem {
  slug: string
  name: string
  tagline: string | null
  raised: number
  goal: number | null
  imageUrl: string | null
}

const aud = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

const TONES = ['orange', 'black', 'cream', 'violet'] as const

export function AppealsCarousel({ appeals }: { appeals: AppealItem[] }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(0)

  function onScroll() {
    const el = ref.current
    if (!el) return
    const card = el.scrollWidth / appeals.length
    setActive(Math.round(el.scrollLeft / card))
  }
  function scrollBy(dir: number) {
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  if (appeals.length === 0) return null

  return (
    <section className="mb-16">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
          Appeals you can <span className="font-extrabold">back</span>
        </h2>
        {appeals.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollBy(-1)}
              aria-label="Previous"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollBy(1)}
              aria-label="Next"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-950 text-white transition-transform hover:scale-105"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={ref}
        onScroll={onScroll}
        className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {appeals.map((a, i) => (
          <div key={a.slug} className="w-[290px] shrink-0 snap-start">
            <AppealCard appeal={a} tone={TONES[i % TONES.length]} />
          </div>
        ))}
      </div>

      {appeals.length > 1 && (
        <div className="mt-5 flex items-center gap-1.5">
          {appeals.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-neutral-950' : 'w-1.5 bg-neutral-300'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function AppealCard({ appeal, tone }: { appeal: AppealItem; tone: (typeof TONES)[number] }) {
  const { name, tagline, raised, goal, imageUrl, slug } = appeal
  const pct = goal && goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null
  const s = {
    orange: { card: 'bg-orange-500 text-white', sub: 'text-orange-100', track: 'bg-white/25', fill: 'bg-white', btn: 'bg-neutral-950 text-white', ph: 'bg-white/15', phIcon: 'text-white/50' },
    black: { card: 'bg-neutral-950 text-white', sub: 'text-neutral-400', track: 'bg-white/15', fill: 'bg-orange-400', btn: 'bg-white text-neutral-950', ph: 'bg-white/10', phIcon: 'text-white/40' },
    cream: { card: 'bg-[#efe9df] text-neutral-950', sub: 'text-neutral-500', track: 'bg-neutral-300/60', fill: 'bg-orange-500', btn: 'bg-neutral-950 text-white', ph: 'bg-white', phIcon: 'text-neutral-300' },
    violet: { card: 'bg-violet-200 text-violet-950', sub: 'text-violet-700', track: 'bg-violet-300/70', fill: 'bg-violet-700', btn: 'bg-violet-900 text-white', ph: 'bg-white/50', phIcon: 'text-violet-400' },
  }[tone]

  return (
    <div className={`flex h-full flex-col rounded-[28px] p-5 ${s.card}`}>
      <div className={`relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl ${s.ph}`}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <ImageIcon className={`h-7 w-7 ${s.phIcon}`} />
        )}
      </div>
      <h3 className="mt-5 text-xl font-bold leading-tight tracking-tight">{name}</h3>
      {tagline && <p className={`mt-2 text-sm leading-snug ${s.sub}`}>{tagline}</p>}

      <div className="mt-auto pt-6">
        {pct !== null && (
          <>
            <div className={`h-2 w-full overflow-hidden rounded-full ${s.track}`}>
              <div className={`h-full rounded-full ${s.fill}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between text-sm">
              <span className="font-bold tabular-nums">{aud(raised)}</span>
              <span className={s.sub}>of {aud(goal!)}</span>
            </div>
          </>
        )}
        <Link
          href={`/funds/${slug}`}
          className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${s.btn}`}
        >
          Give <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
