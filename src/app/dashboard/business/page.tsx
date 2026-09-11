import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireCapability } from '@/lib/permissions'
import {
  getSalesReport,
  getTopSocial,
  getIngestHealth,
  getExposure,
  getDailyTrend,
  type Period,
} from '@/lib/business-reports'
import { SalesVsViews, type Grain } from './SalesVsViews'
import { FeedRefresh } from './FeedRefresh'
import { PostRow } from './PostRow'
import { TopOrganic } from './TopOrganic'
import { TopPaid } from './TopPaid'
import type { FeedName } from '@/lib/actions/feeds.actions'
import { PeriodTabs } from './PeriodTabs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sales & marketing' }

const PERIODS: Period[] = ['day', 'week', 'month', 'year']

/** IngestRun.source → what to call it, and which feed refreshes it. */
const FEED_META: Record<string, { label: string; feed: FeedName }> = {
  'gap-meta-bridge': { label: 'Till sales', feed: 'sales' },
  meta: { label: 'Meta ads and posts', feed: 'meta' },
  mailchimp: { label: 'Mailchimp', feed: 'mailchimp' },
  tiktok: { label: 'TikTok', feed: 'tiktok' },
}

const CHANNEL_LABEL: Record<string, string> = {
  IN_STORE: 'In store',
  CLICK_AND_COLLECT: 'Click & collect',
  HOME_DELIVERY: 'Home delivery',
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

  // Only where the chart *opens*. It carries its own Days/Weeks/Months control
  // and states which it is showing, so choosing "Today" and being shown twelve
  // weeks can no longer happen silently.
  const openingGrain: Grain = period === 'day' ? 'day' : period === 'week' ? 'week' : 'month'

  const [sales, social, health, exposure, trend] = await Promise.all([
    getSalesReport(period),
    getTopSocial(period),
    getIngestHealth(),
    getExposure(period),
    getDailyTrend(365),
  ])

  const hasSales = sales.stores.length > 0
  const hasSocial =
    social.organicByPlatform.length > 0 || social.paid.length > 0 || social.email.length > 0

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

        {/* Did takings and reach move together? The question the two halves of
            this page exist to answer, and which no single figure can — so it
            leads rather than trailing the detail it summarises. */}
        <div className="mt-8 rounded-[28px] border border-neutral-200 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
            Sales and views
          </h2>
          <div className="mt-4">
            <SalesVsViews daily={trend} defaultGrain={openingGrain} />
          </div>
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

        {/* Exposure. Stated as showings rather than people on purpose — see the
            note under it, which is not decoration: this number gets quoted. */}
        {exposure.total > 0 && (
          <div className="mt-4 rounded-[28px] border border-neutral-200 p-5">
            <p className="text-sm font-semibold text-neutral-500">Content seen</p>
            <p className="mt-1 flex items-baseline text-3xl font-extrabold tracking-tight">
              {num(exposure.total)}
              <Delta now={exposure.total} before={exposure.previousTotal} />
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {num(exposure.previousTotal)} in {exposure.previousLabel.toLowerCase()}
            </p>

            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {exposure.sources.map((sr) => (
                <li key={sr.label} className="text-sm">
                  <span className="font-semibold text-neutral-900">{num(sr.views)}</span>{' '}
                  <span className="text-neutral-500">{sr.label.toLowerCase()}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-400">
              Times content was shown, not people. Someone passing four posts counts four times,
              and a boosted post is counted by both its own figures and the ad&apos;s. Ad views are
              measured per day; organic and email are counted against the day they went out and
              keep accruing after. Compare it week to week — the bias is the same each time — but
              it is not a headcount.
            </p>
          </div>
        )}

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
            ) : social.organicByPlatform.length === 0 ? (
              <p className="rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
                Nothing organic in this period.
              </p>
            ) : (
              <TopOrganic groups={social.organicByPlatform} />
            )}
          </Card>

          {social.email.length > 0 && (
            <Card title="Top email">
              <ul className="divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
                {social.email.map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </ul>
            </Card>
          )}

          {social.paid.length > 0 && (
            <Card title="Top paid">
              <TopPaid posts={social.paid} />
            </Card>
          )}
        </div>

        {/* Where each number came from, and when. A figure with no age is a
            figure you cannot trust. */}
        <div className="mt-12 border-t border-neutral-100 pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">Feeds</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Each runs once a day on its own — till sales at 21:30, Meta and Mailchimp at 04:00.
            Daily is all the hosting plan allows, so refresh a feed here if you need it sooner.
          </p>
          {health.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">
              No feed has run yet. Nothing on this page is live.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {health.map((h) => (
                <li key={h.source} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-neutral-700">
                    {FEED_META[h.source]?.label ?? h.source}
                  </span>
                  <span
                    className={
                      h.interrupted
                        ? 'font-semibold text-amber-600'
                        : h.ok
                          ? 'text-neutral-500'
                          : 'font-semibold text-red-600'
                    }
                  >
                    {h.interrupted ? 'cut short' : h.ok ? 'ok' : 'failed'}
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
                  {FEED_META[h.source] && (
                    <FeedRefresh feed={FEED_META[h.source].feed} label={FEED_META[h.source].label} />
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/dashboard/business/bridge"
              className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline"
            >
              POS bridge settings and manual runs
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard/business/tiktok"
              className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline"
            >
              Connect TikTok
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
