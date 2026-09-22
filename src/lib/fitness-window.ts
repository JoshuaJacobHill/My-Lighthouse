/**
 * When a challenge is running, when it stops accepting steps, and how long its
 * result stays up afterwards.
 *
 * Three states rather than two. A challenge that simply vanishes at midnight on
 * the last day takes the result with it — people walked for a month and the
 * page is gone before anyone sees where they finished. So it ends, and then it
 * sits there read-only for a week.
 *
 * Entry closes when the challenge ends, not when the page does. Steps added
 * during the results week would change a total people have already seen and
 * talked about, which is worse than a missed day.
 *
 * Plain module, no Prisma: the page, the server action and the phone endpoint
 * all ask these questions, and one of them runs in the browser.
 */

/** How long the finished result stays readable. */
export const RESULTS_DAYS = 7

export type ChallengeWindow = { startsAt: Date; endsAt: Date }

export type ChallengePhase =
  /** Announced, not started. The page shows a countdown. */
  | 'upcoming'
  /** Running. Steps can be added. */
  | 'running'
  /** Over. Readable, but nothing can be added or changed. */
  | 'results'
  /** Past its results week. Gone from the portal. */
  | 'finished'

/** The last moment the finished challenge is still worth showing. */
export function resultsUntil(endsAt: Date): Date {
  return new Date(endsAt.getTime() + RESULTS_DAYS * 24 * 60 * 60 * 1000)
}

export function challengePhase(c: ChallengeWindow, now: Date = new Date()): ChallengePhase {
  if (now < c.startsAt) return 'upcoming'
  if (now <= c.endsAt) return 'running'
  if (now <= resultsUntil(c.endsAt)) return 'results'
  return 'finished'
}

/**
 * May a step figure be written right now?
 *
 * Asked on the server in `logFitnessAction` and in the phone endpoint, not only
 * where the form is drawn. A form that hides its button is a suggestion; a
 * Shortcut on somebody's phone keeps posting every morning regardless.
 */
export function entriesOpen(c: ChallengeWindow, now: Date = new Date()): boolean {
  const phase = challengePhase(c, now)
  return phase === 'running' || phase === 'upcoming'
}

/** What to tell somebody whose steps arrived too late. */
export const ENTRIES_CLOSED =
  'This challenge has finished, so steps can no longer be added or changed.'
