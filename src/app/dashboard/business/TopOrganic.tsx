'use client'

import * as React from 'react'
import type { TopPost } from '@/lib/business-reports'
import { PostRow, PLATFORM_LABEL } from './PostRow'

/**
 * Top organic posts, filterable by platform.
 *
 * "All" is one combined list of the ten most viewed, whatever posted them.
 *
 * Worth knowing while reading it: Facebook counts post_media_view, Instagram
 * counts total_views across crossposted surfaces, and TikTok counts its own,
 * and those are not the same measurement — Facebook runs around seven times
 * the others per post. So the combined order leans Facebook for reasons of
 * counting rather than performance. Each row carries its platform badge, and
 * the note below says so; picking a single platform removes the problem
 * entirely.
 */

const SHOWN_IN_ALL = 10

export function TopOrganic({
  groups,
}: {
  groups: { platform: string; posts: TopPost[] }[]
}) {
  const [platform, setPlatform] = React.useState<string>('all')

  /** One ranked list across platforms; the per-platform lists stay grouped. */
  const combined = React.useMemo(
    () =>
      groups
        .flatMap((g) => g.posts)
        .sort((a, b) => b.views - a.views || b.engagements - a.engagements)
        .slice(0, SHOWN_IN_ALL),
    [groups],
  )

  const shown = groups.filter((g) => g.platform === platform)

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[{ value: 'all', label: 'All' }, ...groups.map((g) => ({
          value: g.platform,
          label: PLATFORM_LABEL[g.platform] ?? g.platform,
        }))].map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setPlatform(o.value)}
            className={
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors ' +
              (o.value === platform
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
            }
            aria-pressed={o.value === platform}
          >
            {o.label}
          </button>
        ))}
      </div>

      {platform === 'all' ? (
        <ul className="divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
          {combined.map((p) => (
            <PostRow key={p.id} post={p} />
          ))}
        </ul>
      ) : (
        <div className="space-y-5">
          {shown.map((group) => (
            <div key={group.platform}>
              <ul className="divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
                {group.posts.map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {platform === 'all' && groups.length > 1 && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          Top ten by views across every platform. Each counts a &ldquo;view&rdquo; differently —
          Facebook runs around seven times Instagram and TikTok per post — so this leans Facebook
          for reasons of counting as much as reach. Pick a platform to compare like with like.
        </p>
      )}
    </div>
  )
}
