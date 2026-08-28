import type { Prisma } from '@prisma/client'
import type { Capability } from '@/lib/permissions-core'

/**
 * Which side of the ledger an admin may see.
 *
 * Lighthouse Care and Lighthouse Church share one donations table, separated by
 * the fund's `depositAccount` (and the `isTithe` flag for gifts recorded without
 * a fund). A church manager is meant to see tithes and nothing else, so every
 * query behind a shared page has to be narrowed rather than just hidden in the
 * UI — the CSV export in particular would otherwise hand over the whole table.
 */

export type GivingScope = 'care' | 'church' | 'both'

/** Null when the admin has no business seeing giving data at all. */
export function givingScopeFor(held: Capability[]): GivingScope | null {
  const care = held.includes('care.giving')
  const church = held.includes('church.giving')
  if (care && church) return 'both'
  if (care) return 'care'
  if (church) return 'church'
  return null
}

/** A gift belongs to the church side if its fund deposits there, or it's a tithe. */
const CHURCH_GIFT: Prisma.DonationWhereInput = {
  OR: [{ fund: { depositAccount: 'CHURCH' } }, { isTithe: true }],
}

/**
 * Narrow a donation query to one side. Gifts with no fund fall to Care, which
 * matches how they're already labelled in the transactions list.
 */
export function donationScopeWhere(scope: GivingScope): Prisma.DonationWhereInput {
  if (scope === 'both') return {}
  if (scope === 'church') return CHURCH_GIFT
  return { NOT: CHURCH_GIFT }
}

/** Heading for a scoped page, so it's obvious which figures are on screen. */
export function givingScopeLabel(scope: GivingScope): string | null {
  if (scope === 'church') return 'Lighthouse Church'
  if (scope === 'care') return 'Lighthouse Care'
  return null
}
