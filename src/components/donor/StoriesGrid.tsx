'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { ImageIcon, X, ArrowUpRight } from 'lucide-react'
import { Markdown } from '@/components/ui/Markdown'
import { MessageCircle } from 'lucide-react'
import { CommentThread } from '@/components/comments/CommentThread'
import type { CommentView } from '@/lib/comments'

export interface StoryCard {
  id: string
  slug: string
  title: string
  /** When it went live. Null while a story is still a draft. */
  publishedAt: Date | null
  category: string
  excerpt: string | null
  imageUrl: string | null
  externalUrl: string | null
}

function posted(at: Date | null): string | null {
  if (!at) return null
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(at))
}

export function StoriesGrid({
  stories,
  commentsByStory = {},
}: {
  stories: StoryCard[]
  /**
   * Comments for every story on the page, fetched with the stories rather than
   * on open. Opening a story is the one thing in the portal that feels instant,
   * and a round trip on click would spend that.
   */
  commentsByStory?: Record<string, CommentView[]>
}) {
  const params = useSearchParams()

  // Opened straight from a notification: /dashboard/news?story=cindys-story
  // lands on the post itself rather than the list of everything. Resolved as
  // the initial state rather than in an effect, so there is no extra render and
  // no setState-during-effect. The trade-off is that it is read once, on mount:
  // arriving from elsewhere works, changing ?story= while already here does not.
  // Deriving it from the URL every render would fix that but costs a navigation
  // to open a story, and opening a story being instant is the point.
  const wanted = params.get('story')
  const [active, setActive] = React.useState<StoryCard | null>(
    () => (wanted ? stories.find((s) => s.slug === wanted) ?? null : null),
  )

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
              {posted(s.publishedAt) && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {posted(s.publishedAt)}
                </p>
              )}
              {s.excerpt && <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{s.excerpt}</p>}
              <div className="mt-3 flex items-center justify-between text-neutral-400">
                {(commentsByStory[s.id]?.length ?? 0) > 0 ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {commentsByStory[s.id]!.length}
                  </span>
                ) : (
                  <span />
                )}
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
              {posted(active.publishedAt) && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {posted(active.publishedAt)}
                </p>
              )}
              {active.excerpt ? (
                <Markdown source={active.excerpt} className="mt-3 leading-relaxed text-neutral-600" />
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

              <div className="mt-8 border-t border-neutral-100 pt-6">
                <h4 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
                  Comments
                </h4>
                <div className="mt-4">
                  <CommentThread
                    storyId={active.id}
                    comments={commentsByStory[active.id] ?? []}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
