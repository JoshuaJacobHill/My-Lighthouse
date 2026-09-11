'use client'

import * as React from 'react'
import type { TopPost } from '@/lib/business-reports'
import { PostRow, PLATFORM_LABEL } from './PostRow'

/**
 * Top organic posts, filterable by platform.
 *
 * "All" shows the best few from each platform side by side rather than one
 * league table, because Facebook counts post_media_view, Instagram counts
 * total_views across crossposted surfaces and TikTok counts its own — ranking
 * those against each other ranks the counting method, not the post. Picking a
 * platform drops the comparison problem entirely and shows more of it.
 */

const SHOWN_IN_ALL = 3

export function TopOrganic({
  groups,
}: {
  groups: { platform: string; posts: TopPost[] }[]
}) {
  const [platform, setPlatform] = React.useState<string>('all')

  const shown = platform === 'all' ? groups : groups.filter((g) => g.platform === platform)

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

      <div className="space-y-5">
        {shown.map((group) => (
          <div key={group.platform}>
            {/* The heading is redundant once a single platform is picked. */}
            {platform === 'all' && (
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
                {PLATFORM_LABEL[group.platform] ?? group.platform}
              </h3>
            )}
            <ul className="divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
              {(platform === 'all' ? group.posts.slice(0, SHOWN_IN_ALL) : group.posts).map((p) => (
                <PostRow key={p.id} post={p} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {platform === 'all' && groups.length > 1 && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          Ranked within each platform, not against each other — Facebook, Instagram and TikTok each
          count a &ldquo;view&rdquo; differently, so a single league table would rank the counting
          method rather than the post. Pick a platform to see more of it.
        </p>
      )}
    </div>
  )
}
