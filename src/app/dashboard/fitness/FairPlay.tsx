'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { acknowledgeFairPlayAction } from '@/lib/actions/fairplay.actions'

/**
 * The two fair-play cards.
 *
 * Solid colour, white text, no icon — Josh's design. Red carries the personal
 * notice, orange the general reminder, and the difference in colour is doing
 * real work: one is addressed to you, the other is about the challenge. Both
 * also say which they are in the heading, so the distinction never rests on
 * colour alone.
 */

function Card({
  tone,
  heading,
  paragraphs,
  children,
}: {
  tone: 'red' | 'orange'
  heading: string
  paragraphs: readonly string[]
  children?: React.ReactNode
}) {
  return (
    <div
      className={
        'rounded-[28px] px-6 py-6 text-white ' +
        (tone === 'red' ? 'bg-red-600' : 'bg-orange-500')
      }
    >
      <h3 className="text-2xl font-extrabold tracking-tight">{heading}</h3>
      <div className="mt-2 space-y-4 text-[15px] leading-relaxed text-white/95">
        {paragraphs.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
      {children}
    </div>
  )
}

/** Addressed to one person, and stays until an admin withdraws it. */
export function FairPlayNotice({
  heading,
  paragraphs,
}: {
  heading: string
  paragraphs: readonly string[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [read, setRead] = React.useState(false)

  return (
    <Card tone="red" heading={heading} paragraphs={paragraphs}>
      {/* Acknowledging does not clear the card — an admin decides when it comes
          down. It records that it was seen, which is the point of sending it. */}
      {read ? (
        <p className="mt-5 text-sm font-semibold text-white/80">Thanks — noted.</p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await acknowledgeFairPlayAction()
              if (res.success) setRead(true)
            })
          }
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          I’ve read this
        </button>
      )}
    </Card>
  )
}

/** For everyone else, until it expires on its own. */
export function FairPlayReminder({
  heading,
  paragraphs,
}: {
  heading: string
  paragraphs: readonly string[]
}) {
  return <Card tone="orange" heading={heading} paragraphs={paragraphs} />
}
