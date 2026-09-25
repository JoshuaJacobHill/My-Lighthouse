import { describe, expect, it } from 'vitest'
import { ALL_CAPABILITIES, can } from './permissions-core'

/**
 * The list of capabilities and the type must not drift apart.
 *
 * A hand-written second copy of this list in `permissions.ts` hid
 * `business.reports`, then `care.slh`, then `care.families` from the sidebar —
 * each time from everybody, SUPER_ADMIN included, because the nav filters on
 * what `getCapabilities()` returns. The type now derives from the array, so
 * these guard the remaining assumption: that nothing gets dropped from it.
 */
const superAdmin = { role: 'SUPER_ADMIN', canViewDonations: false, canViewBusinessReports: false }

describe('ALL_CAPABILITIES', () => {
  it('includes every capability the app gates on', () => {
    for (const expected of [
      'care.people',
      'care.giving',
      'care.slh',
      'care.families',
      'business.reports',
      'system.users',
    ]) {
      expect(ALL_CAPABILITIES).toContain(expected)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(ALL_CAPABILITIES).size).toBe(ALL_CAPABILITIES.length)
  })

  it('grants every one of them to a super admin', () => {
    // The sidebar shows an item when getCapabilities() contains its `needs`.
    // If this ever fails, a page has become unreachable for everybody.
    for (const capability of ALL_CAPABILITIES) {
      expect(can(superAdmin, capability)).toBe(true)
    }
  })

  it('does not grant the sensitive ones to a plain volunteer', () => {
    const volunteer = { role: 'VOLUNTEER', canViewDonations: false, canViewBusinessReports: false }
    for (const capability of ['care.families', 'care.slh', 'care.giving'] as const) {
      expect(can(volunteer, capability)).toBe(false)
    }
  })
})
