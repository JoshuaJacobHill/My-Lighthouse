import { Medal, Sparkles } from 'lucide-react'
import { MilestoneTrack, GoalReachedShell, GoalReachedBadge } from './Celebration'
import { buildMilestones, LIME, GREEN } from '@/lib/fitness-milestones'
import { paceMessage, walkingTime, type Pace } from '@/lib/fitness-pace'
import type { ScheduleItem } from '@/lib/fitness-data'

/**
 * The read-only panels of the challenge page, kept apart from the page itself
 * so the page stays a thin data shell and these can be rendered — and looked
 * at — with sample data.
 *
 * Bar fills match the chart: #fb923c, with #9a3412 for the standout. That pair
 * clears the palette checks; rank number and name carry identity, so nothing
 * depends on colour alone.
 */

const nf = new Intl.NumberFormat('en-AU')
const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** "11:30" → "11:30 am" */
export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const suffix = h < 12 ? 'am' : 'pm'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`
}

export function TotalSteps({
  total,
  goal,
  participants,
  started,
  behind,
  startLabel,
}: {
  total: number
  goal: number
  participants: number
  started: boolean
  behind: number
  startLabel?: string
}) {
  const pct = Math.min(100, Math.round((total / Math.max(1, goal)) * 100))
  const milestones = buildMilestones(total, goal)
  const done = goal > 0 && total >= goal

  const card = (
    <section className={`p-5 sm:p-6 ${done ? 'text-white' : 'rounded-[28px] border border-neutral-200'}`}>
      {done && <GoalReachedBadge />}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className={`text-lg font-bold tracking-tight ${done ? 'text-white' : 'text-neutral-950'}`}>
          Everyone, this month
        </h2>
        <span
          className={`text-sm font-semibold ${
            done ? 'text-white/80' : !started ? 'text-neutral-500' : behind <= 0 ? 'text-green-700' : 'text-amber-700'
          }`}
        >
          {!started
            ? `Starts ${startLabel ?? '1 September'}`
            : done
              ? 'Goal smashed'
              : behind <= 0
                ? 'On track'
                : `${nf.format(behind)} behind`}
        </span>
      </div>

      <p className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${done ? 'text-white' : 'text-neutral-950'}`}>
        {nf.format(total)}
        <span className={`ml-2 text-base font-semibold ${done ? 'text-white/60' : 'text-neutral-400'}`}>
          of {nf.format(goal)}
        </span>
      </p>
      <p className={`mt-0.5 text-sm ${done ? 'text-white/60' : 'text-neutral-500'}`}>
        combined, from {participants} {participants === 1 ? 'person' : 'people'}
      </p>

      <div className={`mt-4 h-2 w-full overflow-hidden rounded-full ${done ? 'bg-white/20' : 'bg-neutral-100'}`}>
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(pct, total > 0 ? 1.5 : 0)}%`,
            background: done ? LIME : 'linear-gradient(to right, #fb923c, #f97316)',
          }}
        />
      </div>
      <p className={`mt-1.5 text-sm font-semibold ${done ? 'text-white' : 'text-neutral-600'}`}>{pct}%</p>

      <MilestoneTrack milestones={milestones} onLight={!done} />
    </section>
  )

  return done ? <GoalReachedShell>{card}</GoalReachedShell> : card
}

export function TipOfTheDay({ tip }: { tip: string }) {
  return (
    <section className="flex items-start gap-3.5 rounded-[28px] bg-orange-50 p-5 sm:p-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Tip of the day</p>
        <p className="mt-1 font-medium text-neutral-800">{tip}</p>
      </div>
    </section>
  )
}

export function TodaysTarget({ pace }: { pace: Pace }) {
  const covered = pace.todayToGo === 0
  const teamPct = pace.teamPerDay > 0 ? Math.min(100, Math.round((pace.todaySoFar / pace.teamPerDay) * 100)) : 100
  const mineDone = pace.myToday >= pace.personPerDay

  return (
    <section className="rounded-[28px] bg-neutral-950 p-7 text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-white/60">Your steps today</p>
        <p className="text-sm text-white/50">
          {pace.daysRemaining} {pace.daysRemaining === 1 ? 'day' : 'days'} left
        </p>
      </div>

      <p className="animate-count-rise mt-1.5 text-[3.25rem] font-extrabold leading-none tracking-tighter tabular-nums sm:text-6xl">
        {nf.format(pace.myToday)}
      </p>
      <div className="mt-6 rounded-2xl bg-white/10 p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">
            {nf.format(pace.todaySoFar)}{' '}
            <span className="font-normal text-white/50">of {nf.format(pace.teamPerDay)} for the team</span>
          </span>
          <span className={covered ? 'font-bold' : 'text-white/60'} style={covered ? { color: LIME } : undefined}>
            {covered ? 'Done' : `${nf.format(pace.todayToGo)} to go`}
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${Math.max(teamPct, pace.todaySoFar > 0 ? 2 : 0)}%`,
              background: covered ? LIME : 'linear-gradient(to right, #fb923c, #f97316)',
            }}
          />
        </div>
        <p className="mt-2 text-xs text-white/50">Everyone&rsquo;s goal for today</p>
      </div>
    </section>
  )
}
