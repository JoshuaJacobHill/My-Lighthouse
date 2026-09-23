import { describe, expect, it } from 'vitest'
import {
  WISH_STEPS,
  ageOn,
  daysUntil,
  doneCount,
  listComplete,
  nextStep,
  stepDone,
  stepField,
} from './slh-steps'
import { canSubmit, cleanAge, cleanCount, cleanGender, describeRequest } from './slh-onboarding'

describe('wish list steps', () => {
  it('a fresh child has nothing done and starts at the first step', () => {
    expect(doneCount({})).toBe(0)
    expect(nextStep({})?.key).toBe('received')
    expect(listComplete({})).toBe(false)
  })

  it('counts only the steps that carry a timestamp', () => {
    const child = { receivedAt: new Date(), shoppedAt: new Date() }
    expect(doneCount(child)).toBe(2)
    expect(stepDone(child, 'shopped')).toBe(true)
    expect(stepDone(child, 'wrapped')).toBe(false)
  })

  it('sends a shopper back to a gap rather than past it', () => {
    // Wrapped before shopped happens. The next step is the hole, not step 4.
    const child = { receivedAt: new Date(), wrappedAt: new Date() }
    expect(nextStep(child)?.key).toBe('shopped')
  })

  it('is complete only when every step is stamped', () => {
    const all = Object.fromEntries(WISH_STEPS.map((s) => [stepField(s.key), new Date()]))
    expect(listComplete(all)).toBe(true)
    expect(nextStep(all)).toBeNull()
    expect(doneCount(all)).toBe(WISH_STEPS.length)
  })

  it('maps every step to a distinct column', () => {
    const fields = WISH_STEPS.map((s) => stepField(s.key))
    expect(new Set(fields).size).toBe(WISH_STEPS.length)
  })
})

describe('ageOn', () => {
  it('counts whole years', () => {
    expect(ageOn(new Date('2015-06-01T00:00:00Z'), new Date('2026-09-23T00:00:00Z'))).toBe(11)
  })

  it('does not round up before the birthday', () => {
    expect(ageOn(new Date('2015-12-25T00:00:00Z'), new Date('2026-12-24T00:00:00Z'))).toBe(10)
    expect(ageOn(new Date('2015-12-25T00:00:00Z'), new Date('2026-12-25T00:00:00Z'))).toBe(11)
  })

  it('never goes negative', () => {
    expect(ageOn(new Date('2030-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))).toBe(0)
  })
})

describe('daysUntil', () => {
  // Brisbane is UTC+10 with no DST, so 14:00Z is already the next day here.
  it('reads a deadline today as 0 all day', () => {
    expect(daysUntil(new Date('2026-12-20T00:00:00Z'), new Date('2026-12-19T20:00:00Z'))).toBe(0)
  })

  it('counts calendar days, not 24-hour blocks', () => {
    // 23:00 Brisbane on the 19th to the 20th is one day, though it is an hour.
    expect(daysUntil(new Date('2026-12-20T00:00:00Z'), new Date('2026-12-19T13:00:00Z'))).toBe(1)
  })

  it('goes negative once the day has passed', () => {
    expect(daysUntil(new Date('2026-12-01T00:00:00Z'), new Date('2026-12-20T00:00:00Z'))).toBe(-19)
  })
})

describe('onboarding choices', () => {
  it('clamps a count to one of the offered numbers', () => {
    expect(cleanCount(3)).toBe(3)
    expect(cleanCount('10')).toBe(10)
    // Not offered, junk, or hostile — all become the safe wrong answer.
    expect(cleanCount(4)).toBe(1)
    expect(cleanCount(9999)).toBe(1)
    expect(cleanCount('lots')).toBe(1)
    expect(cleanCount(null)).toBe(1)
    expect(cleanCount(-5)).toBe(1)
  })

  it('falls back to "any" for an unrecognised preference', () => {
    expect(cleanAge('5-8')).toBe('5-8')
    expect(cleanAge('42')).toBe('any')
    expect(cleanGender('girl')).toBe('girl')
    expect(cleanGender('<script>')).toBe('any')
  })

  it('needs an organisation and the acknowledgement before it will save', () => {
    expect(canSubmit({ organisationId: 'org_1', acknowledged: true })).toBe(true)
    expect(canSubmit({ organisationId: 'org_1', acknowledged: false })).toBe(false)
    expect(canSubmit({ organisationId: null, acknowledged: true })).toBe(false)
    expect(canSubmit({})).toBe(false)
  })

  it('describes a request as a sentence, dropping the parts that say nothing', () => {
    expect(describeRequest({ requested: 1, preferredAge: 'any', preferredGender: 'any' })).toBe(
      '1 wish list',
    )
    expect(describeRequest({ requested: 2, preferredAge: 'any', preferredGender: 'any' })).toBe(
      '2 wish lists',
    )
    expect(describeRequest({ requested: 2, preferredAge: '5-8', preferredGender: 'girl' })).toBe(
      '2 wish lists · a girl, aged 5–8',
    )
    expect(describeRequest({ requested: 3, preferredAge: '9-12', preferredGender: 'any' })).toBe(
      '3 wish lists · aged 9–12',
    )
  })
})
