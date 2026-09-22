import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Who a ticket order belongs to.
 *
 * The rule these protect is the one in SECURITY.md: proving control of an inbox
 * is what unlocks data, typing an address is not. A ticket order carries
 * somebody's name and an event they attended, so matching one to an account on
 * an unverified address would hand that to whoever guessed the email.
 *
 * So the assertions are about the *query*, not the answer. Mocking Prisma means
 * the return value is whatever the test says it is; what matters is that the
 * filter asked for a verified address in the first place, because that is the
 * line somebody removes while tidying.
 */

const userFindFirst = vi.fn()
const userEmailFindFirst = vi.fn()
const userEmailFindMany = vi.fn()
const orderUpdateMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
    userEmail: {
      findFirst: (...a: unknown[]) => userEmailFindFirst(...a),
      findMany: (...a: unknown[]) => userEmailFindMany(...a),
    },
    ticketOrder: { updateMany: (...a: unknown[]) => orderUpdateMany(...a) },
  },
}))

const { findTicketOwnerByEmail, claimTicketOrdersForUser } = await import('@/lib/tickets')

beforeEach(() => {
  userFindFirst.mockReset().mockResolvedValue(null)
  userEmailFindFirst.mockReset().mockResolvedValue(null)
  userEmailFindMany.mockReset().mockResolvedValue([])
  orderUpdateMany.mockReset().mockResolvedValue({ count: 0 })
})

describe('findTicketOwnerByEmail', () => {
  it('only ever looks for a verified address', () => {
    return findTicketOwnerByEmail('pat@example.com').then(() => {
      expect(userFindFirst.mock.calls[0][0].where.emailVerified).toEqual({ not: null })
      expect(userEmailFindFirst.mock.calls[0][0].where.verifiedAt).toEqual({ not: null })
    })
  })

  it('matches case-insensitively, so a capital does not make a second person', async () => {
    userFindFirst.mockResolvedValue({ id: 'u1' })
    await expect(findTicketOwnerByEmail('  Pat@Example.com ')).resolves.toBe('u1')
    expect(userFindFirst.mock.calls[0][0].where.email).toEqual({
      equals: 'pat@example.com',
      mode: 'insensitive',
    })
  })

  it('falls back to a verified second address on the account', async () => {
    userEmailFindFirst.mockResolvedValue({ userId: 'u2' })
    await expect(findTicketOwnerByEmail('work@example.com')).resolves.toBe('u2')
  })

  it('returns nobody when the address belongs to nobody verified', async () => {
    await expect(findTicketOwnerByEmail('stranger@example.com')).resolves.toBeNull()
  })

  it('returns nobody for an empty address rather than querying', async () => {
    await expect(findTicketOwnerByEmail('   ')).resolves.toBeNull()
    expect(userFindFirst).not.toHaveBeenCalled()
  })
})

describe('claimTicketOrdersForUser', () => {
  it('claims nothing when the account email is unverified', async () => {
    await expect(claimTicketOrdersForUser('u1', 'pat@example.com', null)).resolves.toBe(0)
    expect(orderUpdateMany).not.toHaveBeenCalled()
  })

  it('claims on a verified primary address', async () => {
    orderUpdateMany.mockResolvedValue({ count: 2 })
    await expect(claimTicketOrdersForUser('u1', 'pat@example.com', new Date())).resolves.toBe(2)
    const where = orderUpdateMany.mock.calls[0][0].where
    expect(where.userId).toBeNull() // never steals an order already on an account
    expect(where.OR).toEqual([
      { purchaserEmail: { equals: 'pat@example.com', mode: 'insensitive' } },
    ])
  })

  it('covers the other verified addresses on the account', async () => {
    // Signed up with work, bought the ticket with personal. One person.
    userEmailFindMany.mockResolvedValue([{ email: 'personal@example.com' }])
    orderUpdateMany.mockResolvedValue({ count: 1 })
    await claimTicketOrdersForUser('u1', 'work@example.com', new Date())
    expect(userEmailFindMany.mock.calls[0][0].where.verifiedAt).toEqual({ not: null })
    expect(orderUpdateMany.mock.calls[0][0].where.OR).toHaveLength(2)
  })

  it('claims on a verified second address even when the primary is not verified', async () => {
    userEmailFindMany.mockResolvedValue([{ email: 'personal@example.com' }])
    orderUpdateMany.mockResolvedValue({ count: 1 })
    await expect(claimTicketOrdersForUser('u1', 'work@example.com', null)).resolves.toBe(1)
    expect(orderUpdateMany.mock.calls[0][0].where.OR).toEqual([
      { purchaserEmail: { equals: 'personal@example.com', mode: 'insensitive' } },
    ])
  })
})
