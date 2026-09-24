import { describe, expect, it } from 'vitest'
import { birthdayWindow, listStatus, shopperStatus, shortfall, oneOf } from './slh-admin'

describe('shopperStatus', () => {
  it('is waiting when they have asked for more than they hold', () => {
    expect(shopperStatus({ requested: 3, held: 1, delivered: 0 })).toBe('waiting')
    expect(shopperStatus({ requested: 1, held: 0, delivered: 0 })).toBe('waiting')
  })

  it('is shopping once their request is met and work remains', () => {
    expect(shopperStatus({ requested: 2, held: 2, delivered: 0 })).toBe('shopping')
    expect(shopperStatus({ requested: 2, held: 2, delivered: 1 })).toBe('shopping')
  })

  it('is delivered when every list they hold is in', () => {
    expect(shopperStatus({ requested: 2, held: 2, delivered: 2 })).toBe('delivered')
    // Holding more than they asked for still counts — somebody took an extra.
    expect(shopperStatus({ requested: 1, held: 2, delivered: 2 })).toBe('delivered')
  })

  it('distinguishes stepping back from waiting', () => {
    // Asked for none and holding none is a decision, not a queue.
    expect(shopperStatus({ requested: 0, held: 0, delivered: 0 })).toBe('stepped-back')
  })

  it('counts what somebody is still owed, never below zero', () => {
    expect(shortfall({ requested: 3, held: 1 })).toBe(2)
    expect(shortfall({ requested: 1, held: 3 })).toBe(0)
  })
})

describe('listStatus', () => {
  const base = { filled: true, shopperId: null, deliveredAt: null }

  it('reads delivered first, whatever else is true', () => {
    expect(listStatus({ ...base, filled: false, deliveredAt: new Date() })).toBe('delivered')
  })

  it('reports an unfilled list even when a shopper is holding it', () => {
    // The more urgent fact: somebody is shopping from a list nobody answered.
    expect(listStatus({ ...base, filled: false, shopperId: 'shopper_1' })).toBe('unfilled')
  })

  it('separates ready from assigned', () => {
    expect(listStatus(base)).toBe('ready')
    expect(listStatus({ ...base, shopperId: 'shopper_1' })).toBe('assigned')
  })
})

describe('oneOf', () => {
  it('falls back to everything rather than erroring on a mistyped URL', () => {
    expect(oneOf('waiting', ['waiting', 'shopping'])).toBe('waiting')
    expect(oneOf('nonsense', ['waiting', 'shopping'])).toBe('all')
    expect(oneOf(undefined, ['waiting'])).toBe('all')
  })
})

describe('birthdayWindow', () => {
  // Filtering by a stored date beats computing an age for every row.
  const on = new Date('2026-09-25T00:00:00Z')

  it('covers exactly the ages in the band', () => {
    const w = birthdayWindow('5-8', on)!
    const age = (iso: string) => new Date(iso)

    // An 8-year-old whose birthday was yesterday is in.
    expect(age('2018-09-24T00:00:00Z') > w.gt).toBe(true)
    expect(age('2018-09-24T00:00:00Z') <= w.lte).toBe(true)
    // A 5-year-old who turned 5 today is in.
    expect(age('2021-09-25T00:00:00Z') <= w.lte).toBe(true)
    // A 4-year-old is out, and so is a 9-year-old.
    expect(age('2021-09-26T00:00:00Z') <= w.lte).toBe(false)
    expect(age('2017-09-24T00:00:00Z') > w.gt).toBe(false)
  })

  it('is null for a band nobody offers', () => {
    expect(birthdayWindow('99-100')).toBeNull()
  })
})
