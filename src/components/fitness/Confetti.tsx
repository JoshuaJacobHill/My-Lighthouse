'use client'

import * as React from 'react'
import { LIME, GREEN } from '@/lib/fitness-milestones'

/**
 * A short burst of paper.
 *
 * Deterministic on purpose: a random seed on the server and another on the
 * client mismatch on hydration. Sits absolutely inside a `relative` parent.
 *
 * Extracted from the milestone celebration so the week-winner badge uses the
 * same burst rather than a second implementation drifting away from it.
 */
export function Confetti() {
  // Deterministic — a random seed on the server and another on the client would
  // mismatch on hydration.
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const spread = (i * 37) % 100
        return {
          left: `${spread}%`,
          drift: `${((i * 53) % 60) - 30}px`,
          spin: `${360 + ((i * 97) % 540)}deg`,
          fall: `${2.2 + ((i * 31) % 14) / 10}s`,
          delay: `${((i * 43) % 26) / 10}s`,
          colour: [LIME, GREEN, '#f97316', '#ffffff'][i % 4],
          size: 6 + (i % 3) * 3,
        }
      }),
    []
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0 block rounded-[1px]"
          style={
            {
              left: p.left,
              width: p.size,
              height: p.size * 1.6,
              backgroundColor: p.colour,
              opacity: 0.9,
              '--drift': p.drift,
              '--spin': p.spin,
              '--fall': p.fall,
              '--delay': p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
