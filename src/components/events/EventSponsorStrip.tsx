'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import { SPONSOR_TIER_ORDER, SPONSOR_TIER_LABEL } from '@/lib/sponsor-tiers'
import { SmartImage } from '@/components/ui/SmartImage'

type StripSponsor = {
  id: string
  businessName: string
  logoUrl: string | null
  websiteUrl: string | null
  tier: string
}

export function EventSponsorStrip({ sponsors }: { sponsors: StripSponsor[] }) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = React.useState(false)
  const [canRight, setCanRight] = React.useState(false)

  const groups = SPONSOR_TIER_ORDER.map((tier) => ({
    tier,
    label: SPONSOR_TIER_LABEL[tier],
    items: sponsors.filter((s) => s.tier === tier),
  })).filter((g) => g.items.length > 0)

  const update = React.useCallback(() => {
    const el = scroller.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  React.useEffect(() => {
    update()
    const el = scroller.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update])

  if (groups.length === 0) return null

  function scroll(dir: 1 | -1) {
    scroller.current?.scrollBy({ left: dir * 280, behavior: 'smooth' })
  }

  return (
    <div className="relative mb-8">
      <div
        ref={scroller}
        className="flex items-center gap-6 overflow-x-auto rounded-2xl bg-black px-5 py-4 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g) => (
          <div key={g.tier} className="flex shrink-0 items-center gap-3">
            <span className="shrink-0 text-[11px] font-bold uppercase leading-tight text-white">
              {g.label}
              <br />
              sponsors
            </span>
            {g.items.map((s) => {
              const logo = (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black p-1.5">
                  {s.logoUrl ? (
                    <SmartImage
                      src={s.logoUrl}
                      alt={s.businessName}
                      width={112}
                      height={112}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-gray-500" />
                  )}
                </span>
              )
              return s.websiteUrl ? (
                <a
                  key={s.id}
                  href={s.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.businessName}
                  className="shrink-0"
                >
                  {logo}
                </a>
              ) : (
                <span key={s.id} title={s.businessName} className="shrink-0">
                  {logo}
                </span>
              )
            })}
          </div>
        ))}
      </div>

      {canLeft && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Scroll sponsors left"
          className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md hover:bg-gray-50"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Scroll sponsors right"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md hover:bg-gray-50"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
