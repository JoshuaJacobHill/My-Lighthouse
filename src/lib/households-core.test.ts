import { describe, expect, it } from 'vitest'
import {
  daysSince,
  describeHousehold,
  emailKey,
  oneOfOrNull,
  phoneKey,
  recentlyGiven,
  supportLabel,
} from './households-core'

describe('phoneKey', () => {
  it('matches the same Australian mobile however it was written', () => {
    const forms = ['0412 884 221', '+61412884221', '(04) 1288 4221', '0412-884-221', '61412884221']
    const keys = new Set(forms.map(phoneKey))
    expect(keys.size).toBe(1)
    expect([...keys][0]).toBe('412884221')
  })

  it('ignores anything too short to be a number', () => {
    expect(phoneKey('123')).toBeNull()
    expect(phoneKey('')).toBeNull()
    expect(phoneKey(null)).toBeNull()
  })

  it('matches a landline written with and without its area code spacing', () => {
    expect(phoneKey('07 3806 1234')).toBe(phoneKey('(07) 3806 1234'))
  })
})

describe('emailKey', () => {
  it('folds case and whitespace, and refuses a non-address', () => {
    expect(emailKey('  Leila.M@Example.COM ')).toBe('leila.m@example.com')
    expect(emailKey('not an email')).toBeNull()
  })
})

describe('describeHousehold', () => {
  it('adds the suburb, because a name alone repeats across a caseload', () => {
    expect(describeHousehold({ name: 'Leila M.', suburb: 'Beenleigh' })).toBe(
      'Leila M. · Beenleigh',
    )
  })

  it('counts the children, and says nothing when there are none', () => {
    expect(
      describeHousehold({
        name: 'Leila M.',
        suburb: 'Beenleigh',
        members: [{ relationship: 'CHILD' }, { relationship: 'GUARDIAN' }],
      }),
    ).toBe('Leila M. · Beenleigh · 1 child')

    expect(describeHousehold({ name: 'Dave R.', members: [{ relationship: 'ADULT' }] })).toBe(
      'Dave R.',
    )
  })
})

describe('daysSince', () => {
  it('counts Brisbane days, so yesterday is always 1', () => {
    // Both 11pm Brisbane, a day apart.
    expect(daysSince(new Date('2026-09-24T13:00:00Z'), new Date('2026-09-25T13:00:00Z'))).toBe(1)
    // Same Brisbane day, twelve hours apart.
    expect(daysSince(new Date('2026-09-25T01:00:00Z'), new Date('2026-09-25T13:00:00Z'))).toBe(0)
  })

  it('counts the Brisbane day, not the UTC one', () => {
    // 14:00Z is already midnight tomorrow here. Reading these as UTC days
    // gives 1; the answer a person at a desk wants is 2, because two
    // Brisbane dates have turned over.
    expect(daysSince(new Date('2026-09-24T13:00:00Z'), new Date('2026-09-25T14:00:00Z'))).toBe(2)
  })

  it('is null when they have never had one', () => {
    expect(daysSince(null)).toBeNull()
  })
})

describe('recentlyGiven', () => {
  it('prompts within the window and stays quiet outside it', () => {
    expect(recentlyGiven(3)).toBe(true)
    expect(recentlyGiven(30)).toBe(true)
    expect(recentlyGiven(31)).toBe(false)
    // Never given is not "recently given".
    expect(recentlyGiven(null)).toBe(false)
  })
})

describe('labels and parsing', () => {
  it('names every kind of support', () => {
    expect(supportLabel('FREE_TROLLEY')).toBe('Free trolley')
    expect(supportLabel('nonsense')).toBe('Support')
  })

  it('refuses a value it was not offered', () => {
    expect(oneOfOrNull('CHILD', ['CHILD', 'ADULT'])).toBe('CHILD')
    expect(oneOfOrNull('DOG', ['CHILD', 'ADULT'])).toBeNull()
  })
})
