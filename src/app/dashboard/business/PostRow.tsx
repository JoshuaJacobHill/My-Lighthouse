import type { TopPost } from '@/lib/business-reports'

/**
 * One post in a top-performers list.
 *
 * Client-safe and shared: the organic list is filterable and therefore a
 * client component, while paid and email are rendered on the server. Only
 * the type comes from business-reports — importing a *value* from there would
 * pull Prisma into the browser bundle, which has already broken one build.
 */

export const PLATFORM_LABEL: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  MAILCHIMP: 'Mailchimp',
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

const num = (n: number) => new Intl.NumberFormat('en-AU').format(n)

export function PostRow({ post }: { post: TopPost }) {
  return (
    <li className="flex items-start gap-3 p-4">
      {post.thumbnailUrl ? (
        // A plain img on purpose: these are Meta CDN links that expire and
        // rotate, so next/image would optimise and cache a URL that later dies.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[10px] font-bold uppercase text-neutral-400">
          {PLATFORM_LABEL[post.platform]?.slice(0, 2) ?? '—'}
        </span>
      )}
      <span className="mt-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold uppercase text-neutral-600">
        {PLATFORM_LABEL[post.platform] ?? post.platform}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-neutral-900">
          {post.caption?.trim() || <span className="text-neutral-400">No caption</span>}
        </p>
        {/* An email is measured differently from a post.
            SocialPost.views holds emails_sent for a campaign — the size of the
            list, not a measure of anyone seeing it — so leading with it as
            "views" overstated every campaign by a factor of fifteen. Opens are
            what reached somebody; sent is kept because opens over sent is the
            open rate. */}
        {post.platform === 'MAILCHIMP' ? (
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700">
              {num(post.engagements)} opened
            </span>
            <span>{num(post.views)} sent</span>
            <span className="font-semibold text-neutral-700">
              {post.engagementRate.toFixed(1)}% open rate
            </span>
            {post.clicks > 0 && <span>{num(post.clicks)} clicked</span>}
            {post.audience && <span className="text-neutral-400">{post.audience}</span>}
          </p>
        ) : (
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
            <span>{num(post.views)} views</span>
            <span>{num(post.engagements)} engaged</span>
            <span className="font-semibold text-neutral-700">{post.engagementRate.toFixed(1)}%</span>
            {post.spendCents > 0 && (
              <span className="font-semibold text-neutral-700">{money(post.spendCents)} spent</span>
            )}
            {post.audience && <span className="text-neutral-400">{post.audience}</span>}
          </p>
        )}
      </div>
      {post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-orange-600 hover:underline"
        >
          Open
        </a>
      )}
    </li>
  )
}
