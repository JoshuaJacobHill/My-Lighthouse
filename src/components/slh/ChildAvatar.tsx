/**
 * A child's avatar.
 *
 * A silhouette on a gradient, never a photograph. There are no photographs of
 * these children in this app and there should not be — a shopper gets a first
 * name, an age and a wish list, and that is the whole of it.
 */
export function ChildAvatar({
  gender,
  className,
}: {
  gender: 'girl' | 'boy'
  className?: string
}) {
  const from = gender === 'girl' ? '#ec4899' : '#2563eb'
  const to = gender === 'girl' ? '#fbc7e0' : '#5fd0f5'
  const id = `av-${gender}`

  return (
    <span className={`grid place-items-center overflow-hidden rounded-full ${className ?? ''}`}>
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill={`url(#${id})`} />
        <g fill="rgba(255,255,255,.8)">
          <circle cx="32" cy="26" r="10" />
          <path d="M12 60c0-11 9-20 20-20s20 9 20 20z" />
        </g>
      </svg>
    </span>
  )
}
