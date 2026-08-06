import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Clock,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  User,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Repeat,
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { claimDonationsForUser, getDonorGifts, summariseGifts } from '@/lib/donations'
import { AppealsCarousel, type AppealItem } from '@/components/donor/AppealsCarousel'
import { StoriesGrid } from '@/components/donor/StoriesGrid'
import { StatusBadge } from '@/components/volunteer/StatusBadge'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'My Lighthouse Care' }

const BRISBANE_TZ = 'Australia/Brisbane'

const aud = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

function formatAustralianDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: BRISBANE_TZ,
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: BRISBANE_TZ,
  })
}

const SHIFT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  ATTENDED: 'Attended',
}

const SHIFT_STATUS_COLOURS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 border border-blue-200',
  CONFIRMED: 'bg-green-100 text-green-800 border border-green-200',
  ATTENDED: 'bg-orange-100 text-orange-700 border border-orange-200',
}

const QUICK_ACTIONS = [
  { href: '/volunteer/roster', icon: CalendarPlus, label: 'Book a Shift', description: 'Browse and book available shifts' },
  { href: '/volunteer/availability', icon: Clock, label: 'Update Availability', description: 'Let us know when you can volunteer' },
  { href: '/volunteer/profile', icon: User, label: 'My Profile', description: 'Keep your details up to date' },
  { href: '/volunteer/contact', icon: MessageSquare, label: 'Contact Admin', description: 'Send a message to our team' },
]

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
          firstName: true,
          status: true,
          joinedAt: true,
          lastAttendedAt: true,
          _count: { select: { attendanceRecords: true } },
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
  const firstName = vp?.firstName ?? user.name?.split(' ')[0] ?? 'there'
  const live = isDonorPortalEnabled()

  // Volunteer detail (only fetched for volunteers) — this is the full old
  // volunteer dashboard, folded in so volunteers keep everything on one page.
  const now = new Date()
  let totalHours = 0
  let totalInductionSections = 0
  let completedSections = 0
  let upcomingAssignments: Awaited<ReturnType<typeof getUpcomingAssignments>> = []
  if (vp) {
    const [assignments, hoursResult, sections, progress] = await Promise.all([
      getUpcomingAssignments(vp.id, now),
      prisma.attendanceRecord.aggregate({
        where: { volunteerId: vp.id, durationMins: { not: null } },
        _sum: { durationMins: true },
      }),
      prisma.inductionSection.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.inductionProgress.findMany({ where: { volunteerId: vp.id, completed: true }, select: { sectionId: true } }),
    ])
    upcomingAssignments = assignments
    totalHours = Math.round((hoursResult._sum.durationMins ?? 0) / 60)
    totalInductionSections = sections.length
    completedSections = progress.length
  }
  const totalSessions = vp?._count.attendanceRecords ?? 0

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
        <header className="mb-12 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-400">Welcome back</p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Hi, {firstName} <span className="font-normal">👋</span>
            </h1>
            {vp && (
              <p className="mt-2 text-sm text-neutral-400">Member since {formatAustralianDate(vp.joinedAt)}</p>
            )}
          </div>
          {vp && <StatusBadge status={vp.status} />}
        </header>

        {isVolunteer && vp ? (
          <>
            {/* ── VOLUNTEER-FIRST: the full volunteer dashboard up top ── */}

            {/* Induction alert */}
            {vp.status === 'PENDING_INDUCTION' && (
              <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-[28px] bg-amber-50 p-6 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-amber-900">Complete your induction to start volunteering</p>
                    <p className="mt-0.5 text-sm text-amber-700">
                      Just a few sections to work through first.
                      {totalInductionSections > 0 && ` (${completedSections} of ${totalInductionSections} done)`}
                    </p>
                  </div>
                </div>
                <Link
                  href="/volunteer/induction"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Start induction <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            {/* Induction complete celebration */}
            {vp.status === 'ACTIVE' && !vp.lastAttendedAt && (
              <div className="mb-8 flex items-start gap-3 rounded-[28px] bg-green-50 p-6">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-green-900">Induction complete — welcome to the family!</p>
                  <p className="mt-0.5 text-sm text-green-700">
                    You&rsquo;re now part of the Lighthouse Care volunteer team. We can&rsquo;t wait to see you on your
                    first shift!
                  </p>
                </div>
              </div>
            )}

            {/* Stats */}
            <section className="mb-12 grid grid-cols-2 gap-5 sm:grid-cols-3">
              <StatTile icon={<Clock className="h-6 w-6" />} value={totalHours} label="Hours volunteered" accent />
              <StatTile icon={<CalendarCheck className="h-6 w-6" />} value={totalSessions} label="Shifts attended" />
              <StatTile
                icon={<CalendarDays className="h-6 w-6" />}
                value={vp.lastAttendedAt ? formatAustralianDate(vp.lastAttendedAt) : '—'}
                label="Last attended"
                small
              />
            </section>

            {/* Upcoming shifts */}
            <section className="mb-12">
              <div className="mb-6 flex items-end justify-between">
                <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
                  Your upcoming <span className="font-extrabold">shifts</span>
                </h2>
                <Link
                  href="/volunteer/shifts"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {upcomingAssignments.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-neutral-300" aria-hidden="true" />
                  <p className="font-medium text-neutral-600">No upcoming shifts rostered</p>
                  <Link
                    href="/volunteer/roster"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    Book a shift <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex flex-col gap-3 rounded-[28px] border border-neutral-200 p-6 sm:flex-row sm:items-center"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                        <Calendar className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-950">{formatAustralianDate(assignment.shift.date)}</p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                          {formatTime(assignment.shift.startTime)} – {formatTime(assignment.shift.endTime)} ·{' '}
                          {assignment.shift.location.name}
                          {assignment.shift.department && ` · ${assignment.shift.department.name}`}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          SHIFT_STATUS_COLOURS[assignment.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {SHIFT_STATUS_LABELS[assignment.status] ?? assignment.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quick actions */}
            <section className="mb-16">
              <h2 className="mb-6 text-3xl font-normal tracking-tight sm:text-[2rem]">
                Quick <span className="font-extrabold">actions</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {QUICK_ACTIONS.map(({ href, icon: Icon, label, description }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-4 rounded-[28px] border border-neutral-200 p-6 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-950">{label}</p>
                      <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
                    </div>
                    <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-neutral-300 transition-colors group-hover:text-orange-500" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>

            {/* ── Giving + appeals — kept minimal, below the volunteering ── */}
            <div className="mb-10 border-t border-neutral-100 pt-12">
              <GivingStrip hasGifts={hasGifts} allTime={summary.allTime} />
            </div>
            <AppealsCarousel appeals={appeals} />
          </>
        ) : (
          <>
            {/* ── DONOR-FIRST: giving up top, volunteering invite at the bottom ── */}

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
                        href="/give/again"
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
                    href="/give/again"
                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white"
                  >
                    Make a gift <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </section>

            {/* Appeals */}
            <AppealsCarousel appeals={appeals} />
          </>
        )}

        {/* Good news — shown to everyone */}
        {stories.length > 0 && (
          <section className="mt-4">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
                Good news &amp; <span className="font-extrabold">stories</span>
              </h2>
            </div>
            <StoriesGrid stories={stories} />
          </section>
        )}

        {/* Volunteer invite — donors only, right at the bottom */}
        {!isVolunteer && (
          <section className="mt-16">
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

        {/* Empty state — no giving, no volunteering, nothing featured */}
        {!hasGifts && !isVolunteer && appeals.length === 0 && stories.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-orange-400" />
            <p className="mt-3 text-neutral-600">Welcome to Lighthouse Care.</p>
            <Link
              href="/give/again"
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

function getUpcomingAssignments(volunteerId: string, now: Date) {
  return prisma.shiftAssignment.findMany({
    where: {
      volunteerId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      shift: { date: { gte: now } },
    },
    include: { shift: { include: { location: true, department: true } } },
    orderBy: { shift: { date: 'asc' } },
    take: 3,
  })
}

/** Compact giving prompt shown to volunteers, below their volunteering. */
function GivingStrip({ hasGifts, allTime }: { hasGifts: boolean; allTime: number }) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-[28px] border border-neutral-200 p-6 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Heart className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-neutral-950">
            {hasGifts ? `You've given ${aud(allTime)} — thank you.` : 'Give and change a life'}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {hasGifts
              ? 'Every gift is a trolley of essentials for a family doing it tough.'
              : 'A $25 gift is a full trolley of weekly essentials for a family doing it tough.'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {hasGifts && (
          <Link
            href="/donor/giving"
            className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            My giving <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
        <Link
          href="/give/again"
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {hasGifts ? 'Give again' : 'Make a gift'} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

function StatTile({
  icon,
  value,
  label,
  accent,
  small,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className={`rounded-[28px] p-7 ${accent ? 'bg-orange-500 text-white' : 'border border-neutral-200 text-neutral-950'}`}>
      <span className={accent ? 'text-white' : 'text-orange-500'}>{icon}</span>
      <p className={(small ? 'text-xl sm:text-2xl' : 'text-5xl') + ' mt-5 font-extrabold tracking-tighter tabular-nums'}>
        {value}
      </p>
      <p className={`mt-1 text-sm ${accent ? 'text-orange-100' : 'text-neutral-500'}`}>{label}</p>
    </div>
  )
}
