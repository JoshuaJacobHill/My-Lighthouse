import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ArrowUpRight, Heart, HandHeart, CalendarDays, MapPin, ExternalLink } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { claimDonationsForUser, getDonorGifts, summariseGifts } from '@/lib/donations'
import { StoriesGrid } from '@/components/donor/StoriesGrid'
import { getCurrentChallenge } from '@/lib/fitness-data'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { ChallengeBanner } from '@/components/dashboard/ChallengeBanner'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Lighthouse Care' }

const aud = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

// Home is the "what's happening" tab — Good News & updates, with quick glances
// into giving and volunteering that lead to those dedicated tabs.
export default async function DonorHomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      isChurchMember: true,
      isStaff: true,
      isTrainee: true,
      volunteerProfile: {
        select: { status: true, _count: { select: { attendanceRecords: true } } },
      },
    },
  })
  if (!user) redirect('/login')

  await claimDonationsForUser(session.userId, user.email, user.emailVerified)

  const isStaffOrTrainee = user.isStaff || user.isTrainee

  // One batch rather than a chain. Each of these was costing its own round trip
  // to the database, and none of them depend on each other.
  const [gifts, tithePlan, ehSetting, challenge, stories, events] = await Promise.all([
    getDonorGifts(session.userId),
    prisma.donation.findFirst({
      where: { userId: session.userId, isTithe: true, isRecurring: true },
      orderBy: { createdAt: 'desc' },
      select: { amount: true, frequency: true, createdAt: true },
    }),
    isStaffOrTrainee
      ? prisma.appSetting.findUnique({ where: { key: 'employment_hero_url' }, select: { value: true } })
      : null,
    isStaffOrTrainee ? getCurrentChallenge() : null,
    prisma.story.findMany({
      where: {
        isPublished: true,
        ...(user.isChurchMember ? {} : { churchOnly: false }),
        ...(isStaffOrTrainee ? {} : { staffOnly: false }),
      },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      take: 6,
      select: { id: true, slug: true, title: true, category: true, excerpt: true, imageUrl: true, externalUrl: true },
    }),
    prisma.event.findMany({
      where: {
        isPublished: true,
        OR: [{ startsAt: { gte: new Date() } }, { startsAt: null }],
        ...(user.isChurchMember ? {} : { churchOnly: false }),
      },
      orderBy: { startsAt: 'asc' },
      take: 4,
      select: { id: true, slug: true, title: true, venue: true, startsAt: true },
    }),
  ])

  const summary = summariseGifts(gifts)
  const hasGifts = gifts.length > 0
  const employmentHeroUrl = ehSetting?.value?.trim() || 'https://secure.employmenthero.com'

  const hasTithe = Boolean(tithePlan)

  const vp = user.volunteerProfile
  const isVolunteer = Boolean(vp)
  const firstName = user.name?.split(' ')[0] ?? 'there'
  const live = isDonorPortalEnabled()

  // Payroll deliberately stays in Employment Hero: we link out rather than pull
  // payslips into this portal. Configurable at Admin, Settings, General.
  let challengeBanner: React.ComponentProps<typeof ChallengeBanner> | null = null
  if (challenge) {
    const agg = await prisma.fitnessEntry.aggregate({
      where: { challengeId: challenge.id },
      _sum: { amount: true },
    })
    const total = agg._sum.amount ?? 0
    const now = Date.now()
    const started = now >= challenge.startsAt.getTime()
    challengeBanner = {
      name: challenge.name,
      imageUrl: challenge.imageUrl,
      total,
      goal: challenge.goal,
      progress: challenge.goal > 0 ? Math.min(1, total / challenge.goal) : 0,
      started,
      startLabel: new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        day: 'numeric',
        month: 'long',
      }).format(challenge.startsAt),
      daysLeft: Math.max(
        0,
        Math.ceil(((started ? challenge.endsAt.getTime() : challenge.startsAt.getTime()) - now) / 86_400_000)
      ),
    }
  }

  const fmtEvent = (d: Date | null) =>
    d
      ? d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Australia/Brisbane' })
      : 'Date TBA'

  // Giving and volunteering. Staff open this page for tasks and news, so for
  // them these sit at the bottom rather than above the fold; everyone else
  // still gets them first, because for them it's the whole point of the page.
  const givingAndVolunteering = (
        <section className="mb-14 space-y-5">
          {tithePlan && (
            <Link
              href="/dashboard/tithes"
              className="flex items-center justify-between gap-4 rounded-[28px] bg-neutral-950 p-7 text-white transition-transform active:scale-[0.99]"
            >
              <div>
                <p className="text-sm font-medium text-white/60">Lighthouse Family Church Tithes</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">
                  {aud(Number(tithePlan.amount))}
                  {tithePlan.frequency && <span className="text-lg font-semibold text-white/70"> {tithePlan.frequency}</span>}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white">
                Manage
              </span>
            </Link>
          )}

          <Link
            href="/dashboard/give"
            className="flex items-center justify-between gap-4 rounded-[28px] bg-orange-500 p-7 text-white transition-transform active:scale-[0.99]"
          >
            <div>
              {hasGifts ? (
                <>
                  <p className="text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">{aud(summary.allTime)}</p>
                  <p className="mt-1 text-sm text-orange-100">
                    {hasTithe ? 'Your charitable donations' : 'Your giving so far'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight">Give and change a life</p>
                  <p className="mt-1 text-sm text-orange-100">A $25 gift is a full trolley for a family.</p>
                </>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white">
              {hasGifts ? 'Go to giving' : 'Give now'}
            </span>
          </Link>

          <Link
            href="/volunteer"
            className="group block rounded-[28px] border border-neutral-200 p-7 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
          >
            <HandHeart className="h-7 w-7 text-orange-500" />
            <div className="mt-8">
              {isVolunteer ? (
                <>
                  <p className="text-sm font-medium text-neutral-400">Your volunteering</p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight">
                    {vp?._count.attendanceRecords ?? 0}
                    <span className="text-base font-medium text-neutral-400"> shifts attended</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight">Volunteer with us</p>
                  <p className="mt-1 text-sm text-neutral-500">Give your time alongside your generosity.</p>
                </>
              )}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-600">
                {isVolunteer ? 'Manage volunteering' : 'Get involved'} <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </section>
  )

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {!live && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Preview — donor portal hidden from the public until launch
          </div>
        )}

        {/* Greeting */}
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-400">Welcome back</p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Hi, {firstName} <span className="font-normal">👋</span>
            </h1>
          </div>
          {vp && <StatusBadge status={vp.status} />}
        </header>

        {/* September challenge */}
        {isStaffOrTrainee && challengeBanner && (
          <section className="mb-5">
            <ChallengeBanner {...challengeBanner} />
          </section>
        )}

        {/* Staff shortcuts */}
        {isStaffOrTrainee && (
          <section className="mb-14 grid gap-4 sm:grid-cols-2">
            <Link
              href="/dashboard/tasks"
              className="group flex items-center justify-between gap-4 rounded-[28px] border border-neutral-200 p-6 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Staff</p>
                <p className="mt-1 text-lg font-bold tracking-tight">Tasks &amp; checklists</p>
                <p className="mt-0.5 text-sm text-neutral-500">What&rsquo;s on today</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-neutral-400" />
            </Link>
            <a
              href={employmentHeroUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-[28px] border border-neutral-200 p-6 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Staff</p>
                <p className="mt-1 text-lg font-bold tracking-tight">Payslips &amp; roster</p>
                <p className="mt-0.5 text-sm text-neutral-500">Shifts, timesheets and leave</p>
              </div>
              <ExternalLink className="h-5 w-5 shrink-0 text-neutral-400" />
            </a>
          </section>
        )}

        {!isStaffOrTrainee && givingAndVolunteering}

        {/* Upcoming events */}
        {events.length > 0 && (
          <section className="mb-14">
            <h2 className="mb-6 text-3xl font-normal tracking-tight sm:text-[2rem]">
              Upcoming <span className="font-extrabold">events</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.slug}`}
                  className="group flex items-center gap-4 rounded-[28px] border border-neutral-200 p-5 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                    <CalendarDays className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold tracking-tight">{e.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-neutral-500">
                      <span>{fmtEvent(e.startsAt)}</span>
                      {e.venue && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {e.venue}
                        </span>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-neutral-300 transition-colors group-hover:text-orange-500" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Good News & updates — the heart of Home */}
        {stories.length > 0 ? (
          <section>
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
                Good news &amp; <span className="font-extrabold">stories</span>
              </h2>
            </div>
            <StoriesGrid stories={stories} />
          </section>
        ) : (
          <section className="rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-orange-400" />
            <p className="mt-3 text-neutral-600">Good news stories will appear here soon.</p>
            <Link
              href="/dashboard/give"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Make a gift <ArrowUpRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {isStaffOrTrainee && <div className="mt-14">{givingAndVolunteering}</div>}
      </div>
    </div>
  )
}
