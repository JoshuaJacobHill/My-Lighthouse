'use client'

import * as React from 'react'
import { ImageIcon, X, ArrowUpRight } from 'lucide-react'

export interface StoryCard {
  id: string
  title: string
  category: string
  excerpt: string | null
  imageUrl: string | null
  externalUrl: string | null
}

export function StoriesGrid({ stories }: { stories: StoryCard[] }) {
  const [active, setActive] = React.useState<StoryCard | null>(null)

  React.useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-3">
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s)}
            className="group block overflow-hidden rounded-[28px] border border-neutral-200 text-left transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
          >
            <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-neutral-100">
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-neutral-300" />
              )}
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-neutral-950">
                {s.category}
              </span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold leading-snug tracking-tight">{s.title}</h3>
              {s.excerpt && <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{s.excerpt}</p>}
              <div className="mt-3 flex items-center justify-end text-neutral-400">
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActive(null)} />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <button
              onClick={() => setActive(null)}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative flex aspect-[16/9] shrink-0 items-center justify-center overflow-hidden bg-neutral-100">
              {active.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-10 w-10 text-neutral-300" />
              )}
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-neutral-950">
                {active.category}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-2xl font-bold tracking-tight">{active.title}</h3>
              {active.excerpt ? (
                <p className="mt-3 whitespace-pre-line leading-relaxed text-neutral-600">{active.excerpt}</p>
              ) : (
                <p className="mt-3 text-neutral-400">No further details.</p>
              )}
              {active.externalUrl && (
                <a
                  href={active.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Read the full story <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
