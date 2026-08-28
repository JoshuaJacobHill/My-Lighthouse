/**
 * Milestone maths and the campaign's celebration colours.
 *
 * Deliberately a plain module with no 'use client': both the server-rendered
 * panels and the client-side celebration components need these, and a function
 * exported from a client module cannot be called on the server — it compiles
 * cleanly and then throws at request time.
 *
 * Colours are sampled from the campaign artwork. Both are used as fills behind
 * near-black or white text, never as text colours: lime type on white is close
 * to unreadable, which is why the poster puts it on a photograph.
 */

export const LIME = '#ccf078'
export const GREEN = '#009048'

export interface Milestone {
  /** 0.25, 0.5, 0.75, 1 */
  fraction: number
  label: string
  steps: number
  reached: boolean
}

export function buildMilestones(total: number, goal: number): Milestone[] {
  return [0.25, 0.5, 0.75, 1].map((fraction) => ({
    fraction,
    label: `${Math.round(fraction * 100)}%`,
    steps: Math.round(goal * fraction),
    reached: goal > 0 && total >= Math.round(goal * fraction),
  }))
}
