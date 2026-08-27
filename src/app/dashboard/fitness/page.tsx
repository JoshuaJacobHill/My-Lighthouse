import { redirect, notFound } from 'next/navigation'
import { Footprints, Trophy, Sparkles, Users } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { LogStepsForm } from './LogStepsForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Staff fitness challenge' }

const BNE = 'Australia/Brisbane'
const nf = new Intl.NumberFormat('en-AU')

/** yyyy-mm-dd for a date, in Brisbane time. */
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
  const allowed = me?.isStaff || me?.isTrainee || me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN'
  if (!allowed) notFound()

  const challenge = await prisma.fitnessChallenge.findFirst({
    where: { isActive: true },
    orderBy: { startsAt: 'desc' },
  })
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

  const [totals, mine, board, tips] = await Promise.all([
    prisma.fitnessEntry.aggregate({ where: { challengeId: challenge.id }, _sum: { amount: true } }),
    prisma.fitnessEntry.findMany({
      where: { challengeId: challenge.id, userId: me!.id },
      orderBy: { day: 'desc' },
      select: { day: true, amount: true },
    }),
    prisma.fitnessEntry.groupBy({
      by: ['userId'],
      where: { challengeId: challenge.id },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 15,
    }),
    prisma.wellbeingTip.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { body: true } }),
  ])

  const collective = totals._sum.amount ?? 0
  const pct = Math.min(100, Math.round((collective / challenge.goal) * 100))
  const myTotal = mine.reduce((s, e) => s + e.amount, 0)

  // Resolve leaderboard names in one query.
  const names = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: board.map((b) => b.userId) } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name ?? 'Someone'])
  )

  // Rotate the tip by day of month so everyone sees the same one each day.
  const today = bneDay(new Date())
  const tip = tips.length ? tips[(new Date(today).getDate() - 1) % tips.length].body : null

  const daysTotal = Math.max(
    1,
    Math.round((challenge.endsAt.getTime() - challenge.startsAt.getTime()) / 86_400_000) + 1
  )
  const daysElapsed = Math.max(
    1,
    Math.min(daysTotal, Math.round((Date.now() - challenge.startsAt.getTime()) / 86_400_000) + 1)
  )
  const onTrackTarget = Math.round((challenge.goal / daysTotal) * daysElapsed)
  const ahead = collective >= onTrackTarget

  const existingToday = mine.find((e) => bneDay(e.day) === today)?.amount ?? null

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Staff only</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{challenge.name}</h1>
        <p className="mt-2 text-neutral-500">
          Together we&rsquo;re aiming for <strong className="text-neutral-800">{nf.format(challenge.goal)}</strong>{' '}
          {challenge.unit} this month. Every step counts.
        </p>

        {/* Collective progress */}
        <section className="mt-8 rounded-[28px] bg-orange-500 p-7 text-white">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-100">
            <Users className="h-4 w-4" /> Our total so far
          </div>
          <p className="mt-2 text-5xl font-extrabold tracking-tighter tabular-nums">{nf.format(collective)}</p>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-orange-100">
            <span>{pct}% of {nf.format(challenge.goal)}</span>
            <span>
              {ahead ? '🎉 Ahead of pace' : `${nf.format(Math.max(0, onTrackTarget - collective))} behind pace`}
            </span>
          </div>
        </section>

        {/* Tip of the day */}
        {tip && (
          <section className="mt-5 flex items-start gap-3 rounded-[28px] border border-neutral-200 p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Today&rsquo;s tip</p>
              <p className="mt-1 text-neutral-800">{tip}</p>
            </div>
          </section>
        )}

        {/* Log form */}
        <div className="mt-5">
          <LogStepsForm
            challengeId={challenge.id}
            today={today}
            minDay={bneDay(challenge.startsAt)}
            maxDay={bneDay(challenge.endsAt)}
            existingToday={existingToday}
          />
        </div>

        {/* Personal total */}
        <section className="mt-5 flex items-center justify-between gap-4 rounded-[28px] border border-neutral-200 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-950 text-white">
              <Footprints className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-500">Your total</p>
              <p className="text-2xl font-extrabold tabular-nums">{nf.format(myTotal)}</p>
            </div>
          </div>
          <p className="text-sm text-neutral-400">{mine.length} {mine.length === 1 ? 'day' : 'days'} logged</p>
        </section>

        {/* Leaderboard */}
        {board.length > 0 && (
          <section className="mt-5 rounded-[28px] border border-neutral-200 p-6">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
              <Trophy className="h-5 w-5 text-orange-500" /> Leaderboard
            </h2>
            <ol className="mt-4 divide-y divide-neutral-100">
              {board.map((row, i) => (
                <li key={row.userId} className="flex items-center gap-4 py-2.5">
                  <span className="w-6 text-sm font-bold text-neutral-400">{i + 1}</span>
                  <span className={'flex-1 text-sm ' + (row.userId === me!.id ? 'font-bold text-orange-600' : 'font-medium text-neutral-800')}>
                    {row.userId === me!.id ? 'You' : names.get(row.userId)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-neutral-700">
                    {nf.format(row._sum.amount ?? 0)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}
