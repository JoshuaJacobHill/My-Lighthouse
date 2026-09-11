import Link from 'next/link'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { requireCapability } from '@/lib/permissions'
import { getTikTokStatus } from '@/lib/integrations/tiktok'
import { FeedRefresh } from '../FeedRefresh'
import { DisconnectButton } from './DisconnectButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'TikTok' }

/**
 * Connecting TikTok, and what it has read since.
 *
 * A page rather than two JSON endpoints for two reasons. TikTok's app review
 * requires a demo video that "clearly shows the user interface and user
 * interactions" — a flow that ends on raw JSON would fail that. And it is
 * simply better for whoever operates it: which account is connected, what
 * was granted, and the actual videos read back, on one screen.
 */

const num = (n: number) => new Intl.NumberFormat('en-AU').format(n)

const when = (d: Date) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)

export default async function TikTokPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; scopes?: string; error?: string }>
}) {
  await requireCapability('business.reports')
  const [status, params] = await Promise.all([getTikTokStatus(), searchParams])

  return (
    <div className="-m-4 min-h-full bg-white lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/business"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Sales &amp; marketing
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">TikTok</h1>
        <p className="mt-2 max-w-xl text-neutral-500">
          Reads the views and engagement of videos posted by our own TikTok account, so they appear
          in the marketing report beside Facebook, Instagram and email. Nothing here posts, edits or
          deletes anything on TikTok.
        </p>

        {params.error && (
          <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{params.error}</p>
        )}

        {params.connected && !params.error && (
          <p className="mt-6 rounded-2xl bg-lime-50 p-4 text-sm text-lime-800">
            Connected. {params.scopes ? `TikTok granted: ${params.scopes}` : ''}
          </p>
        )}

        {/* ── Connection ── */}
        <div className="mt-7 rounded-[28px] border border-neutral-200 p-5">
          <h2 className="text-lg font-bold">Connection</h2>

          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">App credentials</dt>
              <dd
                className={
                  'rounded-full px-2.5 py-1 text-xs font-bold ' +
                  (status.configured ? 'bg-lime-100 text-lime-800' : 'bg-neutral-100 text-neutral-600')
                }
              >
                {status.configured ? 'Configured' : 'Not configured'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Account authorised</dt>
              <dd
                className={
                  'rounded-full px-2.5 py-1 text-xs font-bold ' +
                  (status.connected ? 'bg-lime-100 text-lime-800' : 'bg-neutral-100 text-neutral-600')
                }
              >
                {status.connected ? 'Connected' : 'Not connected'}
              </dd>
            </div>
            {status.clientKey && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-600">Client key in use</dt>
                <dd className="break-all text-right font-mono text-xs text-neutral-600">
                  {status.clientKey}
                </dd>
              </div>
            )}
            {status.scopesGranted.length > 0 && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-600">Permissions granted</dt>
                <dd className="text-right font-mono text-xs text-neutral-600">
                  {status.scopesGranted.join(', ')}
                </dd>
              </div>
            )}
          </dl>

          {status.clientKeyHadWhitespace && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              The credentials in Vercel have a space or newline around them. They are trimmed
              before use, so this is not breaking anything now, but it is worth tidying.
            </p>
          )}

          {!status.configured ? (
            <p className="mt-4 rounded-2xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
              Add <code className="font-mono">TIKTOK_CLIENT_KEY</code> and{' '}
              <code className="font-mono">TIKTOK_CLIENT_SECRET</code> from the TikTok developer
              portal, redeploy, then connect here.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {/* A plain link, not a form: this starts a redirect to TikTok. */}
              <a
                href="/api/admin/tiktok-connect"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                {status.connected ? 'Reconnect TikTok' : 'Connect TikTok'}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              {status.connected && <FeedRefresh feed="tiktok" label="TikTok" />}
              {status.connected && <DisconnectButton />}
            </div>
          )}

          {status.connected && !status.canReadVideos && status.scopesGranted.length > 0 && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              The <code className="font-mono">video.list</code> permission was not granted, so no
              videos can be read — which looks exactly like an account with no posts. Reconnect and
              leave every permission switched on.
            </p>
          )}
        </div>

        {/* ── What it has read ── */}
        <div className="mt-6 rounded-[28px] border border-neutral-200 p-5">
          <h2 className="text-lg font-bold">Videos read</h2>
          {status.lastRun ? (
            <p className="mt-2 text-sm text-neutral-600">
              Last run {when(status.lastRun.at)} ·{' '}
              {status.lastRun.ok ? (
                <span className="font-semibold text-lime-700">{status.lastRun.rows} read</span>
              ) : (
                <span className="font-semibold text-red-700">failed</span>
              )}
              {status.videoCount > 0 && ` · ${status.videoCount} held in total`}
            </p>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Has not run yet.</p>
          )}
          {status.lastRun?.error && (
            <p className="mt-2 rounded-2xl bg-red-50 p-3 font-mono text-xs text-red-700">
              {status.lastRun.error}
            </p>
          )}

          {status.videos.length > 0 && (
            <ul className="mt-4 divide-y divide-neutral-100">
              {status.videos.map((v) => (
                <li key={v.externalId} className="flex items-start gap-3 py-3">
                  {v.thumbnailUrl ? (
                    // A plain img: TikTok CDN links expire, so next/image would
                    // optimise and cache a URL that later dies.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="h-16 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="h-16 w-12 shrink-0 rounded-lg bg-neutral-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-neutral-900">
                      {v.caption?.trim() || <span className="text-neutral-400">No caption</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                      <span>{num(v.views)} views</span>
                      <span>{num(v.engagements)} engaged</span>
                      <span className="text-neutral-400">{when(v.publishedAt)}</span>
                    </p>
                  </div>
                  {v.permalink && (
                    <a
                      href={v.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-semibold text-orange-600 hover:underline"
                    >
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
