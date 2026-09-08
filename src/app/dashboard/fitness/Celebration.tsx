'use client'

import * as React from 'react'
import { Check, Lock, PartyPopper } from 'lucide-react'
import { LIME, GREEN, type Milestone } from '@/lib/fitness-milestones'
import { Confetti } from '@/components/fitness/Confetti'

/**
 * Milestones and the celebration when one lands.
 *
 * Colours come from the campaign artwork — lime #ccf078 and deep green #009048.
 * Both are used as fills behind near-black or white text rather than as text
 * colours: lime type on white is close to unreadable, which is exactly why the
 * poster puts it on a photograph.
 *
 * Every milestone carries a tick or a padlock and a written label as well as a
 * colour, so the state never depends on seeing the colour.
 */

const nf = new Intl.NumberFormat('en-AU')


/** `onLight` styles the not-yet-reached markers for a white card rather than a dark one. */
export function MilestoneTrack({ milestones, onLight = false }: { milestones: Milestone[]; onLight?: boolean }) {
  const idle = onLight
    ? { box: 'bg-neutral-100', icon: 'text-neutral-400', label: 'text-neutral-500', steps: 'text-neutral-400' }
    : { box: 'bg-white/10', icon: 'text-white/40', label: 'text-white/50', steps: 'text-white/30' }

  return (
    <ul className="mt-5 grid grid-cols-4 gap-2">
      {milestones.map((m) => (
        <li
          key={m.fraction}
          className={`rounded-2xl px-2 py-2.5 text-center transition-colors ${
            m.reached ? 'animate-milestone-pop' : idle.box
          }`}
          style={m.reached ? { backgroundColor: m.fraction === 1 ? GREEN : LIME } : undefined}
        >
          <span
            className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full ${
              m.reached ? (m.fraction === 1 ? 'bg-white/25 text-white' : 'bg-black/15 text-neutral-900') : idle.icon
            }`}
          >
            {m.reached ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
          </span>
          <span
            className={`mt-1 block text-sm font-extrabold ${
              m.reached ? (m.fraction === 1 ? 'text-white' : 'text-neutral-900') : idle.label
            }`}
          >
            {m.label}
          </span>
          <span
            className={`block text-[10px] font-semibold ${
              m.reached ? (m.fraction === 1 ? 'text-white/70' : 'text-neutral-900/60') : idle.steps
            }`}
          >
            {nf.format(m.steps)}
          </span>
          <span className="sr-only">{m.reached ? 'reached' : 'not reached yet'}</span>
        </li>
      ))}
    </ul>
  )
}

/** Wraps the total card so it can turn celebratory once the goal is done. */
export function GoalReachedShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="animate-goal-glow relative overflow-hidden rounded-[28px]"
      style={{ background: `linear-gradient(135deg, ${GREEN} 0%, #046b3a 55%, #05301d 100%)` }}
    >
      <Confetti />
      <div className="relative">{children}</div>
    </div>
  )
}

export function GoalReachedBadge() {
  return (
    <p
      className="animate-milestone-pop mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold text-neutral-900"
      style={{ backgroundColor: LIME }}
    >
      <PartyPopper className="h-4 w-4" aria-hidden="true" />
      We did it — 10 million steps
    </p>
  )
}
