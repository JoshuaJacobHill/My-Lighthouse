import { requireCapability } from '@/lib/permissions'
import {
  getSalesReport,
  getTopSocial,
  getIngestHealth,
  type Period,
  type TopPost,
} from '@/lib/business-reports'
import { PeriodTabs } from './PeriodTabs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sales & marketing' }

const PERIODS: Period[] = ['day', 'week', 'month', 'year']

const CHANNEL_LABEL: Record<string, string> = {
  IN_STORE: 'In store',
  CLICK_AND_COLLECT: 'Click & collect',
  HOME_DELIVERY: 'Home delivery',
}

const PLATFORM_LABEL: Record<string, string> = {
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

/** Up or down against the same period before. Null when there is nothing to compare. */
function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) return null
  const pct = Math.round(((now - before) / before) * 100)
  const up = pct >= 0
  return (
    <span
      className={
        'ml-2 rounded-full px-2 py-0.5 text-xs font-bold ' +
        (up ? 'bg-lime-100 text-lime-800' : 'bg-red-100 text-red-700')
      }
    >
      {up ? '+' : ''}
      {pct}%
    </span>
  )
}

function PostRow({ post }: { post: TopPost }) {
  return (
    <li className="flex items-start gap-3 p-4">
      <span className="mt-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold uppercase text-neutral-600">
        {PLATFORM_LABEL[post.platform] ?? post.platform}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-neutral-900">
          {post.caption?.trim() || <span className="text-neutral-400">No caption</span>}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
          <span>{num(post.views)} views</span>
          <span>{num(post.engagements)} engaged</span>
          <span className="font-semibold text-neutral-700">{post.engagementRate.toFixed(1)}%</span>
          {post.spendCents > 0 && <span>{money(post.spendCents)} spent</span>}
        </p>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function NotConnected({ what }: { what: string }) {
  return (
    <p className="rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
      Nothing from {what} yet. Once the feed is connected the numbers appear here — this is
      deliberately blank rather than showing zeros, so an unconnected feed never reads as a bad
      week.
    </p>
  )
}

export default async function BusinessReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  await requireCapability('business.reports')

  const { period: raw } = await searchParams
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : 'month'

  const [sales, social, health] = await Promise.all([
    getSalesReport(period),
    getTopSocial(period),
    getIngestHealth(),
  ])

  const hasSales = sales.stores.length > 0
  const hasSocial = social.organic.length > 0 || social.paid.length > 0

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
          Managers only
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Sales &amp; marketing
        </h1>
        <p className="mt-2 text-neutral-500">{sales.range.label}</p>

        <div className="mt-6">
          <PeriodTabs active={period} />
        </div>

        {/* Headline */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[28px] border border-neutral-200 p-5">
            <p className="text-sm font-semibold text-neutral-500">Revenue</p>
            <p className="mt-1 flex items-baseline text-3xl font-extrabold tracking-tight">
              {money(sales.revenueCents)}
              <Delta now={sales.revenueCents} before={sales.previous.revenueCents} />
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {money(sales.previous.revenueCents)} in {sales.previous.label.toLowerCase()}
            </p>
          </div>
          <div className="rounded-[28px] border border-neutral-200 p-5">
            <p className="text-sm font-semibold text-neutral-500">Orders</p>
            <p className="mt-1 flex items-baseline text-3xl font-extrabold tracking-tight">
              {num(sales.orders)}
              <Delta now={sales.orders} before={sales.previous.orders} />
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {num(sales.previous.orders)} in {sales.previous.label.toLowerCase()}
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-10">
          <Card title="By store and channel">
            {!hasSales ? (
              <NotConnected what="Gap Solutions or MyFoodLink" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {sales.stores.map((s) => (
                  <div key={s.store} className="rounded-[28px] border border-neutral-200 p-5">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-bold">{s.store}</h3>
                      <span className="text-sm font-semibold">{money(s.revenueCents)}</span>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {s.channels.map((c) => (
                        <li key={c.channel} className="flex items-baseline justify-between text-sm">
                          <span className="text-neutral-600">
                            {CHANNEL_LABEL[c.channel] ?? c.channel}
                          </span>
                          <span className="text-neutral-900">
                            {money(c.revenueCents)}{' '}
                            <span className="text-neutral-400">· {num(c.orders)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Top organic">
            {!hasSocial ? (
              <NotConnected what="Meta, TikTok or Mailchimp" />
            ) : social.organic.length === 0 ? (
              <p className="rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
                Nothing organic in this period.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
                {social.organic.map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </ul>
            )}
          </Card>

          {hasSocial && (
            <Card title="Top paid">
              {social.paid.length === 0 ? (
                <p className="rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
                  No paid activity in this period.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
                  {social.paid.map((p) => (
                    <PostRow key={p.id} post={p} />
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* Where each number came from, and when. A figure with no age is a
            figure you cannot trust. */}
        <div className="mt-12 border-t border-neutral-100 pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">Feeds</h2>
          {health.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">
              No feed has run yet. Nothing on this page is live.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {health.map((h) => (
                <li key={h.source} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-neutral-700">{h.source}</span>
                  <span className={h.ok ? 'text-neutral-500' : 'font-semibold text-red-600'}>
                    {h.ok ? 'ok' : 'failed'}
                  </span>
                  <span className="text-neutral-400">
                    {h.at
                      ? new Intl.DateTimeFormat('en-AU', {
                          timeZone: 'Australia/Brisbane',
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        }).format(h.at)
                      : 'never'}
                  </span>
                  {h.error && <span className="text-red-500">{h.error.slice(0, 120)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
