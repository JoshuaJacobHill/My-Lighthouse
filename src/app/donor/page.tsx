import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  HandHeart,
  CalendarCheck,
  CalendarDays,
  ImageIcon,
  Repeat,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { claimDonationsForUser, getDonorGifts, summariseGifts } from '@/lib/donations'
import { AppealsCarousel, type AppealItem } from '@/components/donor/AppealsCarousel'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'My Lighthouse Care' }

const aud = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

export default async function DonorHomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      volunteerProfile: {
        select: {
          id: true,
          joinedAt: true,
          preferredLocations: true,
          _count: { select: { attendanceRecords: true, shiftAssignments: true } },
        },
      },
    },
  })
  if (!user) redirect('/login')

  await claimDonationsForUser(session.userId, user.email, user.emailVerified)

  const gifts = await getDonorGifts(session.userId)
  const summary = summariseGifts(gifts)
  const hasGifts = gifts.length > 0
  const hasRecurring = gifts.some((g) => g.isRecurring)
  const vp = user.volunteerProfile
  const isVolunteer = Boolean(vp)
  const firstName = user.name?.split(' ')[0] ?? 'there'
  const live = isDonorPortalEnabled()

  // Only show the giving block to people who actually give (never-givers and
  // volunteer-only users see a volunteering-first dashboard instead).
  const showGiving = hasGifts

  // Appeals = active funds featured on the dashboard, with raised computed.
  const funds = await prisma.fund.findMany({
    where: { isActive: true, showOnDashboard: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, tagline: true, goalAmount: true, imageUrl: true },
  })
  const raised = new Map<string, number>()
  if (funds.length) {
    const grouped = await prisma.donation.groupBy({
      by: ['fundId'],
      where: { fundId: { in: funds.map((f) => f.id) } },
      _sum: { amount: true },
    })
    for (const g of grouped) if (g.fundId) raised.set(g.fundId, Number(g._sum.amount ?? 0))
  }
  const appeals: AppealItem[] = funds.map((f) => ({
    slug: f.slug,
    name: f.name,
    tagline: f.tagline,
    goal: f.goalAmount ? Number(f.goalAmount) : null,
    imageUrl: f.imageUrl,
    raised: raised.get(f.id) ?? 0,
  }))

  const stories = await prisma.story.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    take: 6,
    select: { id: true, title: true, category: true, excerpt: true, imageUrl: true, externalUrl: true },
  })

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {!live && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Preview — donor portal hidden from the public until launch
          </div>
        )}

        {/* Greeting */}
        <header className="mb-12">
          <p className="text-sm font-medium text-neutral-400">Welcome back</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Hi, {firstName} <span className="font-normal">👋</span>
          </h1>
        </header>

        {/* Giving */}
        {showGiving && (
          <section className="mb-16">
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-[28px] bg-orange-500 p-8 text-white lg:col-span-2">
                <div className="flex items-center gap-2.5">
                  <p className="text-sm font-medium text-orange-100">Your giving so far</p>
                  {hasRecurring && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
                      <Repeat className="h-3 w-3" /> Recurring
                    </span>
                  )}
                </div>
                <p className="mt-4 text-6xl font-extrabold tracking-tighter tabular-nums sm:text-7xl">
                  {aud(summary.allTime)}
                </p>
                <p className="mt-3 text-sm text-orange-100">
                  {aud(summary.financialYear)} this financial year · {summary.count}{' '}
                  {summary.count === 1 ? 'gift' : 'gifts'}
                </p>
                <div className="mt-9">
                  <Link
                    href="/donate"
                    className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white"
                  >
                    Give again <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-[28px] bg-neutral-950 p-8 text-white">
                <div>
                  <p className="text-sm font-medium text-neutral-500">Most recent gift</p>
                  {gifts[0] && (
                    <>
                      <p className="mt-3 text-3xl font-bold tracking-tight">{aud(gifts[0].amount)}</p>
                      <p className="mt-1 text-sm text-neutral-400">
                        {gifts[0].fundName ?? 'General'} ·{' '}
                        {gifts[0].createdAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </p>
                    </>
                  )}
                </div>
                <Link
                  href="/donate"
                  className="mt-6 inline-flex items-center justify-between gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-950"
                >
                  Give again <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Appeals */}
        <AppealsCarousel appeals={appeals} />

        {/* Volunteering */}
        {isVolunteer && vp && (
          <section className="mb-16">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
                Your <span className="font-extrabold">volunteering</span>
              </h2>
              <Link
                href="/volunteer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                Volunteer portal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <StatTile icon={<HandHeart className="h-6 w-6" />} value={vp._count.attendanceRecords} label="Attendances" accent />
              <StatTile icon={<CalendarCheck className="h-6 w-6" />} value={vp._count.shiftAssignments} label="Shifts booked" />
              <StatTile
                icon={<CalendarDays className="h-6 w-6" />}
                value={vp.joinedAt.getFullYear()}
                label="Volunteering since"
              />
            </div>
          </section>
        )}

        {/* Good news */}
        {stories.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
                Good news &amp; <span className="font-extrabold">stories</span>
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {stories.map((s) => {
                const inner = (
                  <>
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
                      {s.externalUrl && (
                        <div className="mt-3 flex items-center justify-end text-neutral-500">
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </>
                )
                const cls =
                  'group block overflow-hidden rounded-[28px] border border-neutral-200 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60'
                return s.externalUrl ? (
                  <a key={s.id} href={s.externalUrl} target="_blank" rel="noopener noreferrer" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <article key={s.id} className={cls}>
                    {inner}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state — no giving, no volunteering, nothing featured */}
        {!showGiving && !isVolunteer && appeals.length === 0 && stories.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-orange-400" />
            <p className="mt-3 text-neutral-600">Welcome to Lighthouse Care.</p>
            <Link
              href="/donate"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Make a donation <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-[28px] p-7 ${accent ? 'bg-orange-500 text-white' : 'border border-neutral-200 text-neutral-950'}`}>
      <span className={accent ? 'text-white' : 'text-orange-500'}>{icon}</span>
      <p className="mt-5 text-5xl font-extrabold tracking-tighter tabular-nums">{value}</p>
      <p className={`mt-1 text-sm ${accent ? 'text-orange-100' : 'text-neutral-500'}`}>{label}</p>
    </div>
  )
}
