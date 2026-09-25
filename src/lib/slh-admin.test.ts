import { describe, expect, it } from 'vitest'
import {
  birthdayWindow,
  listStatus,
  planAssignments,
  shopperStatus,
  shortfall,
  oneOf,
  type AssignableChild,
  type AssignableShopper,
} from './slh-admin'

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

describe('planAssignments', () => {
  const child = (
    id: string,
    over: Partial<AssignableChild> = {},
  ): AssignableChild => ({
    id,
    organisationId: 'org',
    gender: 'girl',
    age: 7,
    nominatedAt: 1,
    ...over,
  })
  const shopper = (
    id: string,
    over: Partial<AssignableShopper> = {},
  ): AssignableShopper => ({
    id,
    organisationId: 'org',
    preferredAge: 'any',
    preferredGender: 'any',
    wants: 1,
    ...over,
  })

  it('never gives one child to two shoppers', () => {
    const plan = planAssignments([shopper('a'), shopper('b')], [child('kid')])
    expect(plan.flatMap((p) => p.childIds)).toEqual(['kid'])
  })

  it('spends the fussy shoppers first, so nobody is starved', () => {
    // The bug this exists to prevent: "any" takes the only girl, and the
    // shopper who asked for a girl gets nothing while a boy goes unassigned.
    const plan = planAssignments(
      [shopper('flexible'), shopper('wants-girl', { preferredGender: 'girl' })],
      [child('girl-1', { gender: 'girl' }), child('boy-1', { gender: 'boy' })],
    )
    const byShopper = Object.fromEntries(plan.map((p) => [p.shopperId, p.childIds]))
    expect(byShopper['wants-girl']).toEqual(['girl-1'])
    expect(byShopper['flexible']).toEqual(['boy-1'])
  })

  it('respects an age band and leaves somebody short rather than breaking it', () => {
    const plan = planAssignments(
      [shopper('teens', { preferredAge: '13-17' })],
      [child('little', { age: 6 })],
    )
    // No match is better than a surprise: they are left short and the page
    // says so.
    expect(plan).toEqual([])
  })

  it('takes the longest-waiting children first', () => {
    const plan = planAssignments(
      [shopper('a', { wants: 1 })],
      [child('newer', { nominatedAt: 200 }), child('older', { nominatedAt: 100 })],
    )
    expect(plan[0].childIds).toEqual(['older'])
  })

  it('never crosses organisations', () => {
    const plan = planAssignments(
      [shopper('a', { organisationId: 'org-1' })],
      [child('kid', { organisationId: 'org-2' })],
    )
    expect(plan).toEqual([])
  })

  it('gives a shopper no more than they asked for', () => {
    const plan = planAssignments(
      [shopper('a', { wants: 2 })],
      [child('1'), child('2'), child('3')],
    )
    expect(plan[0].childIds).toHaveLength(2)
  })

  it('ignores somebody who is not owed anything', () => {
    expect(planAssignments([shopper('a', { wants: 0 })], [child('1')])).toEqual([])
  })
})
