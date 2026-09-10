import { describe, expect, it, vi } from 'vitest'

// The database is mocked away: this file tests the decision that protects the
// ledger, not the ledger itself. The unique constraint on saleIdentifier is
// what enforces it in Postgres; this is the layer above.
vi.mock('@/lib/prisma', () => ({ default: {} }))

import { GapSaleStatus } from '@prisma/client'
import { shouldReprocess, type BridgeSettings } from './gap-bridge'

const settings: BridgeSettings = {
  dryRun: true,
  sendIdentifiers: false,
  lookbackMinutes: 60,
  maxAttempts: 6,
}

describe('deduplication', () => {
  it('processes a sale it has never seen', () => {
    expect(shouldReprocess(null, settings)).toBe(true)
  })

  it('never sends a sale that has already been sent', () => {
    // The whole point of the bridge. An overlapping window means every sale is
    // offered again every ten minutes for an hour.
    expect(shouldReprocess({ status: GapSaleStatus.SENT, attemptCount: 1 }, settings)).toBe(false)
  })

  it('does not reconsider an anonymous sale forever', () => {
    expect(
      shouldReprocess({ status: GapSaleStatus.SKIPPED_NO_CUSTOMER, attemptCount: 0 }, settings),
    ).toBe(false)
  })

  it('leaves refunds and odd transaction types alone', () => {
    expect(
      shouldReprocess({ status: GapSaleStatus.SKIPPED_TRAN_TYPE, attemptCount: 0 }, settings),
    ).toBe(false)
  })

  it('picks a held sale back up once identifiers are switched on', () => {
    const held = { status: GapSaleStatus.SKIPPED_IDENTIFIERS_OFF, attemptCount: 0 }
    expect(shouldReprocess(held, settings)).toBe(false)
    expect(shouldReprocess(held, { ...settings, sendIdentifiers: true })).toBe(true)
  })

  it('retries a failure until the attempt cap, then stops', () => {
    expect(shouldReprocess({ status: GapSaleStatus.FAILED, attemptCount: 5 }, settings)).toBe(true)
    expect(shouldReprocess({ status: GapSaleStatus.FAILED, attemptCount: 6 }, settings)).toBe(false)
  })

  it('finishes a sale left pending', () => {
    expect(shouldReprocess({ status: GapSaleStatus.PENDING, attemptCount: 0 }, settings)).toBe(true)
  })
})
