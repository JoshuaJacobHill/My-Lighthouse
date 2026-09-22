import { describe, it, expect } from 'vitest'
import {
  challengePhase,
  entriesOpen,
  resultsUntil,
  RESULTS_DAYS,
} from '@/lib/fitness-window'

/**
 * The wind-down: entry closes when the challenge ends, the page outlives it by
 * a week.
 *
 * The boundary that matters is the last day. The challenge ends at 23:59:59 on
 * the 30th in Brisbane, and somebody logging their steps at 11pm that night
 * should still get in — an off-by-one here takes the last day off everybody.
 */

// 1 Sept – 30 Sept 2026, Brisbane (UTC+10), as the column stores it.
const CHALLENGE = {
  startsAt: new Date('2026-08-31T14:00:00.000Z'),
  endsAt: new Date('2026-09-30T13:59:59.000Z'),
}

const bne = (iso: string) => new Date(`${iso}+10:00`)

describe('challengePhase', () => {
  it('is upcoming before it starts', () => {
    expect(challengePhase(CHALLENGE, bne('2026-08-31T23:59:59'))).toBe('upcoming')
  })

  it('is running from the first minute of the first day', () => {
    expect(challengePhase(CHALLENGE, bne('2026-09-01T00:00:00'))).toBe('running')
  })

  it('is still running at eleven at night on the last day', () => {
    expect(challengePhase(CHALLENGE, bne('2026-09-30T23:00:00'))).toBe('running')
  })

  it('turns to results once the month is over', () => {
    expect(challengePhase(CHALLENGE, bne('2026-10-01T00:30:00'))).toBe('results')
  })

  it('stays readable for a week', () => {
    expect(challengePhase(CHALLENGE, bne('2026-10-07T12:00:00'))).toBe('results')
  })

  it('is finished once the week is up', () => {
    expect(challengePhase(CHALLENGE, bne('2026-10-09T00:00:00'))).toBe('finished')
  })
})

describe('entriesOpen', () => {
  it('lets somebody log at 11pm on the last night', () => {
    expect(entriesOpen(CHALLENGE, bne('2026-09-30T23:00:00'))).toBe(true)
  })

  it('closes on the first of October', () => {
    expect(entriesOpen(CHALLENGE, bne('2026-10-01T00:00:01'))).toBe(false)
  })

  it('stays closed through the results week, while the page is still up', () => {
    const when = bne('2026-10-03T09:00:00')
    expect(challengePhase(CHALLENGE, when)).toBe('results')
    expect(entriesOpen(CHALLENGE, when)).toBe(false)
  })
})

describe('resultsUntil', () => {
  it('is a week after the end', () => {
    const until = resultsUntil(CHALLENGE.endsAt)
    expect(until.getTime() - CHALLENGE.endsAt.getTime()).toBe(RESULTS_DAYS * 86_400_000)
  })
})
