import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Footprints, Smartphone, ChevronRight, Lock, Settings } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { LogStepsForm } from './LogStepsForm'
import { StepsChart } from './StepsChart'
import { TotalSteps, TopFive, TipOfTheDay, TodaysTarget } from './ChallengePanels'
import { WeekSchedule } from './WeekSchedule'
import { PaceNudge } from './PaceNudge'
import { computePace, paceMessage } from '@/lib/fitness-pace'
import { isAdminRole } from '@/lib/permissions-core'
import { brisbaneToday, calendarDayString } from '@/lib/fitness-days'
import { getChallengeBoard, getTipOfTheDay, getWellbeingSchedule, getCurrentChallenge } from '@/lib/fitness-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Staff fitness challenge' }

const BNE = 'Australia/Brisbane'
const nf = new Intl.NumberFormat('en-AU')

/** Challenge start/end are real instants, so they're read in Brisbane time. */
function bneDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BNE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export default async function StaffFitnessPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, isStaff: true, isTrainee: true, role: true },
  })
  if (!me || !(me.isStaff || me.isTrainee || isAdminRole(me.role))) notFound()

  const challenge = await getCurrentChallenge()
  if (!challenge) {
    return (
      <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Staff fitness challenge</h1>
          <p className="mt-2 text-neutral-500">No challenge is running at the moment — check back soon.</p>
        </div>
      </div>
    )
  }

  const [board, tip, schedule, mine, eligible, fitnessLink] = await Promise.all([
    getChallengeBoard(challenge),
    getTipOfTheDay(),
    getWellbeingSchedule(challenge),
    prisma.fitnessEntry.findMany({
      where: { challengeId: challenge.id, userId: me.id },
      orderBy: { day: 'desc' },
      select: { day: true, amount: true },
    }),
    prisma.user.count({ where: { OR: [{ isStaff: true }, { isTrainee: true }], isActive: true } }),
    prisma.fitnessLink.findFirst({
      where: { userId: me.id, revokedAt: null },
      select: { lastUsedAt: true, lastAmount: true },
    }),
  ])

  const today = brisbaneToday()
  const myTotal = mine.reduce((sum, e) => sum + e.amount, 0)
  const existingToday = mine.find((e) => calendarDayString(e.day) === today)?.amount ?? null
  const pct = Math.min(100, Math.round((board.total / challenge.goal) * 100))

  // A linked phone that has not reported in a day and a half has almost always
  // been installed without an automation, so it only runs when tapped.
  const phoneStale =
    Boolean(fitnessLink) &&
    (!fitnessLink?.lastUsedAt || Date.now() - fitnessLink.lastUsedAt.getTime() > 36 * 3_600_000)

  const started = Date.now() >= challenge.startsAt.getTime()
  const todaySoFar = board.days.find((d) => d.day === today)?.total ?? 0
  const pace = computePace({
    goal: challenge.goal,
    total: board.total,
    participants: board.participants,
    daysTotal: board.days.length,
    daysElapsed: board.days.filter((d) => !d.future).length,
    todaySoFar,
    myToday: existingToday ?? 0,
    myTotal,
    eligible,
  })
  const startLabel = new Intl.DateTimeFormat('en-AU', {
    timeZone: BNE,
    day: 'numeric',
    month: 'long',
  }).format(challenge.startsAt)
  const daysTotal = board.days.length
  const daysElapsed = board.days.filter((d) => !d.future).length
  const onTrack = Math.round((challenge.goal / Math.max(1, daysTotal)) * daysElapsed)
  const ahead = board.total >= onTrack


  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-600">Staff challenge</p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl">{challenge.name}</h1>
        <p className="mt-2.5 max-w-xl text-neutral-500">
          Ten million steps between us across September. Walk the long way, take the stairs, get outside at lunch.
          It all counts.
        </p>
        {!started && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3.5 py-1.5 text-sm font-semibold text-orange-700">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />
            Starts {startLabel}
          </p>
        )}


        {started ? (
          <div className="mt-7">
            <TodaysTarget pace={pace} />
          </div>
        ) : (
          <div className="mt-7">
            <TotalSteps
              total={board.total}
              goal={challenge.goal}
              participants={board.participants}
              started={started}
              behind={onTrack - board.total}
              startLabel={startLabel}
            />
          </div>
        )}

        {started && (
          <div className="mt-4">
            <PaceNudge message={paceMessage(pace)} positive={pace.myShareMet || pace.todayToGo === 0} />
          </div>
        )}

        {/* ── Your bit ── */}
        <section className="mt-5 flex items-center justify-between gap-4 rounded-[28px] border border-neutral-200 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <Footprints className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-500">Your total</p>
              <p className="text-2xl font-extrabold tabular-nums">{nf.format(myTotal)}</p>
            </div>
          </div>
          <p className="text-sm text-neutral-400">
            {mine.length} {mine.length === 1 ? 'day' : 'days'} logged
          </p>
        </section>

        {started ? (
          <div className="mt-3">
            <LogStepsForm
              challengeId={challenge.id}
              today={today}
              minDay={bneDay(challenge.startsAt)}
              maxDay={bneDay(challenge.endsAt)}
              existingToday={existingToday}
              screenshotEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
            />
          </div>
        ) : (
          <section className="mt-3 flex items-start gap-3.5 rounded-[28px] border border-dashed border-neutral-300 bg-neutral-50 p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-200 text-neutral-600">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-neutral-950">Step logging opens on {startLabel}</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Nothing to do yet. You can link your phone now so it is ready on day one.
              </p>
            </div>
          </section>
        )}

        {!fitnessLink && (
          <Link
            href="/dashboard/fitness/connect"
            className="mt-3 flex items-center justify-between gap-4 rounded-[28px] border border-neutral-200 p-5 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                <Smartphone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold text-neutral-950">Link your steps to Apple Health</p>
                <p className="text-sm text-neutral-500">
                  Your phone sends the daily total on its own. Takes about two minutes.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
          </Link>
        )}

        {/* ── Day by day ── */}
        {started && (
          <div className="mt-5">
            <TotalSteps
              total={board.total}
              goal={challenge.goal}
              participants={board.participants}
              started={started}
              behind={onTrack - board.total}
              startLabel={startLabel}
            />
          </div>
        )}

        <div className="mt-5">
          <StepsChart days={board.days} todayIndex={board.todayIndex} />
        </div>

        <div className="mt-5">
          <TopFive rows={board.top} />
        </div>

        {tip && (
          <div className="mt-5">
            <TipOfTheDay tip={tip} />
          </div>
        )}

        <div className="mt-5">
          <WeekSchedule schedule={schedule} />
        </div>

        {fitnessLink && (
          <div className="mt-5 flex flex-col items-center gap-3">
            {phoneStale && (
              <Link
                href="/dashboard/fitness/connect"
                className="w-full rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 hover:bg-amber-100"
              >
                <span className="font-semibold">Your phone has stopped sending steps.</span>{' '}
                {fitnessLink.lastUsedAt
                  ? 'It probably needs an automation so it runs on its own.'
                  : 'Run the shortcut once to get started.'}
              </Link>
            )}
            <Link
              href="/dashboard/fitness/connect"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Apple Health settings
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-neutral-400">
          Steps are shared with the team. Nothing else from your phone is.
        </p>
      </div>
    </div>
  )
}
