import { describe, it, expect } from 'vitest'
import { buildMilestones, goalPhrase } from '@/lib/fitness-milestones'

/**
 * The goal is a column on the challenge, not a constant, so everything that
 * talks about it has to be derived from it. These cover the two places that
 * previously were not: the milestone maths, and the prose.
 */

describe('goalPhrase', () => {
  it('says five million, not 5000000', () => {
    expect(goalPhrase(5_000_000)).toBe('5 million')
  })

  it('keeps a half million rather than rounding it away', () => {
    expect(goalPhrase(7_500_000)).toBe('7.5 million')
  })

  it('falls back to a plain number below a million', () => {
    expect(goalPhrase(750_000)).toBe('750,000')
  })
})

describe('buildMilestones', () => {
  it('follows the goal wherever it moves', () => {
    expect(buildMilestones(0, 5_000_000).map((m) => m.steps)).toEqual([
      1_250_000, 2_500_000, 3_750_000, 5_000_000,
    ])
  })

  it('marks the ones already passed', () => {
    const reached = buildMilestones(2_600_000, 5_000_000).filter((m) => m.reached)
    expect(reached.map((m) => m.label)).toEqual(['25%', '50%'])
  })

  it('reaches nothing on a goal of zero rather than everything', () => {
    // total >= 0 is true for every milestone, so a missing goal would otherwise
    // light up the whole track and fire the celebration.
    expect(buildMilestones(0, 0).some((m) => m.reached)).toBe(false)
  })
})
