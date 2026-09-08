import { Trophy } from 'lucide-react'
import type { ChecklistMonth } from '@/lib/checklist-leaderboard'

const nf = new Intl.NumberFormat('en-AU')

/**
 * Who has ticked the most this month.
 *
 * Says "ticked off" rather than "done" on purpose. The number counts
 * completions, and a completion is a tick — worth showing, worth reading with
 * that in mind.
 */
export function ChecklistLeaderboard({
  month,
  meId,
}: {
  month: ChecklistMonth
  meId: string
}) {
  const top = month.standings.slice(0, 5)
  const leader = top[0]

  return (
    <section className="rounded-[28px] border border-neutral-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight">Ticked off this month</h2>
        <p className="text-sm text-neutral-500">{month.label}</p>
      </div>

      <ul className="mt-4 space-y-2">
        {top.map((s, i) => {
          const isMe = s.userId === meId
          return (
            <li
              key={s.userId}
              className={
                'flex items-baseline justify-between rounded-xl px-3 py-2 text-sm ' +
                (isMe ? 'bg-orange-50 font-semibold text-neutral-900' : 'text-neutral-700')
              }
            >
              <span className="flex items-center gap-2">
                {i === 0 ? (
                  <Trophy className="h-4 w-4 text-orange-600" aria-hidden="true" />
                ) : (
                  <span className="w-4 text-center text-neutral-400">{i + 1}</span>
                )}
                {s.name}
                {isMe && <span className="text-xs font-normal text-neutral-500">(you)</span>}
              </span>
              <span>{nf.format(s.completions)}</span>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-400">
        {nf.format(month.total)} between everyone so far.
        {leader ? ` ${leader.name.split(/\s+/)[0]} is ahead.` : ''} Counts items ticked off, so
        it shows who is keeping on top of the list rather than how long anything took.
      </p>
    </section>
  )
}
