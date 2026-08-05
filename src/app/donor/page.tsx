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
  Repeat,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { claimDonationsForUser, getDonorGifts, summariseGifts } from '@/lib/donations'
import { AppealsCarousel, type AppealItem } from '@/components/donor/AppealsCarousel'
import { StoriesGrid } from '@/components/donor/StoriesGrid'

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
          status: true,
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

  // Volunteer specifics folded in from the old volunteer dashboard.
  const pendingInduction = vp?.status === 'PENDING_INDUCTION'
  const upcomingShifts = vp
    ? await prisma.shiftAssignment.findMany({
        where: {
          volunteerId: vp.id,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          shift: { date: { gte: new Date() } },
        },
        include: { shift: { include: { location: true } } },
        orderBy: { shift: { date: 'asc' } },
        take: 3,
      })
    : []

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
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
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
        <section className="mb-16">
          {hasGifts ? (
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
                  href="/donor/giving"
                  className="mt-6 inline-flex items-center justify-between gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-950"
                >
                  View all giving &amp; receipts <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] bg-orange-500 p-8 text-white sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Give and change a life</h2>
                <p className="mt-1.5 text-orange-100">
                  A $25 gift is a full trolley of weekly essentials for a family doing it tough.
                </p>
              </div>
              <Link
                href="/donate"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white"
              >
                Make a gift <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>

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
                href="/volunteer/shifts"
                className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                My shifts <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {pendingInduction && (
              <div className="mb-5 flex flex-col items-start justify-between gap-4 rounded-[28px] bg-amber-50 p-6 sm:flex-row sm:items-center">
                <p className="text-sm font-medium text-amber-800">
                  Complete your induction to start booking shifts.
                </p>
                <Link
                  href="/volunteer/induction"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Start induction <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <StatTile icon={<HandHeart className="h-6 w-6" />} value={vp._count.attendanceRecords} label="Attendances" accent />
              <StatTile icon={<CalendarCheck className="h-6 w-6" />} value={vp._count.shiftAssignments} label="Shifts booked" />
              <StatTile
                icon={<CalendarDays className="h-6 w-6" />}
                value={vp.joinedAt.getFullYear()}
                label="Volunteering since"
              />
            </div>

            {upcomingShifts.length > 0 && (
              <div className="mt-5 rounded-[28px] border border-neutral-200 p-6">
                <h3 className="text-lg font-bold tracking-tight">Your next shifts</h3>
                <div className="mt-4 space-y-3">
                  {upcomingShifts.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 rounded-2xl bg-neutral-50 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
                        <CalendarCheck className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-950">
                          {a.shift.date.toLocaleDateString('en-AU', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            timeZone: 'Australia/Brisbane',
                          })}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                          {a.shift.startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Australia/Brisbane' })}
                          {' · '}
                          {a.shift.location.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Become a volunteer (shown to non-volunteers) */}
        {!isVolunteer && (
          <section className="mb-16">
            <div className="flex flex-col items-start justify-between gap-5 rounded-[28px] bg-neutral-950 p-8 text-white sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Want to volunteer too?</h2>
                <p className="mt-1.5 text-neutral-400">
                  Give your time alongside your generosity — join the team behind the mission.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Sign up to volunteer <ArrowRight className="h-4 w-4" />
              </Link>
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
            <StoriesGrid stories={stories} />
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
