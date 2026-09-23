/**
 * A stand-in for the Santa's Little Helpers logo.
 *
 * Drawn inline so the preview needs no asset pipeline. The face and beard carry
 * hairlines because both are near-white and so is the plate behind them —
 * without them all you see is the hat. Replace with the real artwork.
 */
export function SantaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="34" r="16" fill="#f4ece1" stroke="rgba(0,0,0,.12)" />
      <path
        d="M32 46c7 0 12 4 12 4a15 15 0 0 1-24 0s5-4 12-4z"
        fill="#fff"
        stroke="rgba(0,0,0,.12)"
      />
      <circle cx="26" cy="32" r="2.1" fill="#1b1b1b" />
      <circle cx="38" cy="32" r="2.1" fill="#1b1b1b" />
      <circle cx="32" cy="38" r="2.6" fill="#c8102e" />
      <path d="M15 28C15 18 22 11 32 11s17 7 17 17z" fill="#c8102e" />
      <rect x="13" y="26" width="38" height="7" rx="3.5" fill="#fff" stroke="rgba(0,0,0,.12)" />
      <circle cx="50" cy="15" r="5" fill="#fff" stroke="rgba(0,0,0,.12)" />
    </svg>
  )
}
