/**
 * Turning a ten-million-step goal into something a person can act on today.
 *
 * The collective number is good for a rallying cry and useless as guidance —
 * nobody knows what to do with "8,240,000 to go". What people can act on is
 * "about 2,400 steps each today", so everything here works back from the goal
 * to one person's share of one day.
 *
 * Pure functions on numbers, so the arithmetic can be checked on its own.
 */

export interface Pace {
  daysTotal: number
  daysElapsed: number
  /** Days still to come, including today. */
  daysRemaining: number

  /** Steps the whole team still needs each remaining day. */
  teamPerDay: number
  /** One person's share of that. */
  personPerDay: number

  /** Team steps logged today so far. */
  todaySoFar: number
  /** Still needed today to stay on the pace above. */
  todayToGo: number

  /** Your own total, average per elapsed day, and what you'd need from here. */
  myTotal: number
  myAveragePerDay: number
  myPerDay: number
  /** Are you keeping up with an even share of the goal? */
  myShareMet: boolean

  onTrack: boolean
  finished: boolean
}

export function computePace(input: {
  goal: number
  total: number
  participants: number
  daysTotal: number
  daysElapsed: number
  todaySoFar: number
  myTotal: number
}): Pace {
  const { goal, total, participants, daysTotal, daysElapsed, todaySoFar, myTotal } = input

  const daysRemaining = Math.max(0, daysTotal - daysElapsed + (daysElapsed > 0 ? 1 : 0))
  const remaining = Math.max(0, goal - total)
  const finished = remaining === 0

  // Split across the days still to come, today included — otherwise the target
  // is always yesterday's problem.
  const teamPerDay = daysRemaining > 0 ? Math.ceil(remaining / daysRemaining) : remaining
  // At least one walker, so the sums hold up before anyone has logged anything.
  const heads = Math.max(1, participants)
  const personPerDay = Math.ceil(teamPerDay / heads)

  const todayToGo = Math.max(0, teamPerDay - todaySoFar)

  const elapsedOrOne = Math.max(1, daysElapsed)
  const myAveragePerDay = Math.round(myTotal / elapsedOrOne)
  // An even share of what's left, for you alone.
  const myPerDay = personPerDay
  const myShareMet = myAveragePerDay >= personPerDay

  // Where the whole team should be by the end of today.
  const expectedByNow = daysTotal > 0 ? (goal / daysTotal) * Math.max(1, daysElapsed) : 0

  return {
    daysTotal,
    daysElapsed,
    daysRemaining,
    teamPerDay,
    personPerDay,
    todaySoFar,
    todayToGo,
    myTotal,
    myAveragePerDay,
    myPerDay,
    myShareMet,
    onTrack: total >= expectedByNow,
    finished,
  }
}

/**
 * Roughly how long a number of steps takes to walk, at an ordinary pace of
 * about 110 steps a minute. Only ever used to describe the *gap* someone needs
 * to close, because "2,000 more" means far less to most people than
 * "about twenty minutes".
 */
export function walkingMinutes(steps: number): number {
  return Math.max(1, Math.round(steps / 110))
}

/** "20 minutes" / "1 hr 40 min" — kept vague on purpose; it's an estimate. */
export function walkingTime(steps: number): string {
  const mins = walkingMinutes(steps)
  if (mins < 60) return `${mins} minutes`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

/**
 * A short, human line about where things stand. Written here rather than in the
 * component so the wording is in one place and never contradicts the figures
 * sitting next to it.
 */
export function paceMessage(pace: Pace): string {
  if (pace.finished) return 'We’ve done it. Anything from here is a bonus.'
  if (pace.daysRemaining <= 0) return 'That’s the month done.'

  if (pace.todayToGo === 0) {
    return 'Today’s target is already covered — anything more puts us ahead.'
  }
  if (pace.myAveragePerDay === 0) {
    return `Nothing logged yet — your share works out at about ${fmt(pace.personPerDay)} steps a day.`
  }
  if (pace.myShareMet) {
    return `You’re above your share at ${fmt(pace.myAveragePerDay)} a day. Every extra one helps carry someone having a rough week.`
  }
  const gap = pace.personPerDay - pace.myAveragePerDay
  return `You’re averaging ${fmt(pace.myAveragePerDay)} a day. Another ${fmt(gap)} — roughly ${walkingTime(gap)} of walking — would put you on your share.`
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-AU').format(n)
}
