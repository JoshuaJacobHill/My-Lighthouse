/**
 * How far along one wish list is.
 *
 * One segment per step rather than a single bar: a shopper wants to know how
 * many things are left, not a percentage, and six little marks answer that
 * without being read.
 */
export function StepTrack({
  done,
  total,
  className,
}: {
  done: number
  total: number
  className?: string
}) {
  return (
    <div
      className={`flex gap-1 ${className ?? ''}`}
      role="img"
      aria-label={`${done} of ${total} steps done`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < done ? 'bg-green-600' : 'bg-neutral-200'}`}
        />
      ))}
    </div>
  )
}
