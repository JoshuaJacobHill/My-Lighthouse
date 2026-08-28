import { Sparkles, CalendarDays, Medal } from 'lucide-react'
import { MilestoneTrack, GoalReachedShell, GoalReachedBadge } from './Celebration'
import { buildMilestones, LIME, GREEN } from '@/lib/fitness-milestones'
import { paceMessage, walkingTime, type Pace } from '@/lib/fitness-pace'
import type { Standing, ScheduleItem } from '@/lib/fitness-data'

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
}: {
  total: number
  goal: number
  participants: number
  started: boolean
  behind: number
}) {
  const pct = Math.min(100, Math.round((total / Math.max(1, goal)) * 100))
  const milestones = buildMilestones(total, goal)
  const done = goal > 0 && total >= goal
  const latest = [...milestones].reverse().find((m) => m.reached)

  const card = (
    <section className={`p-7 text-white ${done ? '' : 'rounded-[28px] bg-neutral-950'}`}>
      {done && <GoalReachedBadge />}
      <p className="text-sm font-medium text-white/60">Our total so far</p>
      <p className="animate-count-rise mt-1.5 text-[3.25rem] font-extrabold leading-none tracking-tighter tabular-nums sm:text-6xl">
        {nf.format(total)}
      </p>
      <p className="mt-1.5 text-sm text-white/60">
        of {nf.format(goal)} steps &middot; {participants} {participants === 1 ? 'person' : 'people'} walking
      </p>
      <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(pct, total > 0 ? 1.5 : 0)}%`,
            background: done ? LIME : 'linear-gradient(to right, #fb923c, #f97316)',
          }}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{pct}%</span>
        <span className="text-white/60">
          {!started
            ? 'Starts 1 September'
            : done
              ? 'Goal smashed'
              : behind <= 0
                ? 'Ahead of pace'
                : `${nf.format(behind)} behind pace`}
        </span>
      </div>

      <MilestoneTrack milestones={milestones} />
      {started && !done && latest && (
        <p className="mt-3 text-sm font-semibold" style={{ color: LIME }}>
          {latest.label} of the way there — nice work.
        </p>
      )}
    </section>
  )

  return done ? <GoalReachedShell>{card}</GoalReachedShell> : card
}

export function TopFive({ rows }: { rows: Standing[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total))
  return (
    <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-neutral-950">Top 5 this month</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          Nobody has logged any steps yet. Be the first &mdash; it only takes a second.
        </p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {rows.map((row, i) => (
            <li key={row.userId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={`w-5 shrink-0 text-sm font-bold tabular-nums ${i === 0 ? 'text-orange-600' : 'text-neutral-400'}`}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate font-semibold text-neutral-900">{row.name}</span>
                  {i === 0 && <Medal className="h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">
                  {nf.format(row.total)}
                </span>
              </div>
              <div className="ml-7 mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.round((row.total / max) * 100))}%`,
                    backgroundColor: i === 0 ? '#9a3412' : '#fb923c',
                  }}
                />
              </div>
              <p className="ml-7 mt-1 text-xs text-neutral-400">
                {row.days} {row.days === 1 ? 'day' : 'days'} logged
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
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

export function WeeklySchedule({ schedule }: { schedule: ScheduleItem[] }) {
  const byWeekday = DAY_NAMES.map((_, i) => ({ weekday: i, list: schedule.filter((s) => s.weekday === i) })).filter(
    (d) => d.list.length > 0
  )
  return (
    <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-neutral-950">This week</h2>
      <p className="mt-0.5 text-sm text-neutral-500">Everyone&rsquo;s welcome &mdash; come along to whatever suits.</p>
      {byWeekday.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Nothing scheduled yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-neutral-100">
          {byWeekday.map(({ weekday, list }) => (
            <div key={weekday} className="flex gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="w-20 shrink-0 sm:w-24">
                <p className={`text-sm font-bold ${list[0].isToday ? 'text-orange-600' : 'text-neutral-900'}`}>
                  {DAY_NAMES[weekday]}
                </p>
                {list[0].isToday && <p className="text-xs font-semibold text-orange-500">Today</p>}
              </div>
              <ul className="min-w-0 flex-1 space-y-3">
                {list.map((s) => (
                  <li key={s.id}>
                    <p className="font-semibold text-neutral-900">{s.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {clock(s.startTime)}
                        {s.endTime && ` – ${clock(s.endTime)}`}
                      </span>
                      {s.location && <span>&middot; {s.location}</span>}
                      {s.leader && <span>&middot; with {s.leader}</span>}
                    </p>
                    {s.notes && <p className="mt-0.5 text-xs italic text-neutral-400">{s.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * What the goal means for one person, today.
 *
 * Sits directly under the collective total because that number, on its own,
 * tells nobody what to do. "Your share: 2,400 today" does.
 */
export function TodaysTarget({ pace }: { pace: Pace }) {
  const covered = pace.todayToGo === 0
  const teamPct = pace.teamPerDay > 0 ? Math.min(100, Math.round((pace.todaySoFar / pace.teamPerDay) * 100)) : 100

  return (
    <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold tracking-tight text-neutral-950">Today</h2>
        <p className="text-sm text-neutral-500">
          {pace.daysRemaining} {pace.daysRemaining === 1 ? 'day' : 'days'} left
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your share today</p>
          <p className="mt-0.5 text-4xl font-extrabold tracking-tight tabular-nums text-neutral-950">
            {nf.format(pace.personPerDay)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">about {walkingTime(pace.personPerDay)} of walking</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Everyone together</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums text-neutral-700">
            {nf.format(pace.teamPerDay)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">a day, from here</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-neutral-700">
            {nf.format(pace.todaySoFar)} <span className="font-normal text-neutral-400">logged today</span>
          </span>
          <span className={covered ? 'font-semibold' : 'text-neutral-500'} style={covered ? { color: GREEN } : undefined}>
            {covered ? 'Target met' : `${nf.format(pace.todayToGo)} to go`}
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${Math.max(teamPct, pace.todaySoFar > 0 ? 2 : 0)}%`,
              background: covered ? GREEN : 'linear-gradient(to right, #fb923c, #f97316)',
            }}
          />
        </div>
      </div>

      <p
        className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-900"
        style={{ backgroundColor: pace.myShareMet || covered ? LIME : '#fff7ed' }}
      >
        {paceMessage(pace)}
      </p>
    </section>
  )
}
