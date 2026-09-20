import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The email rule, tested on the cases that would actually cost somebody
 * something.
 *
 * The one that matters most is the passwordless row: a donor who gave $200 and
 * has no login. If `assertEmailFree` ever returns null for that, anybody who
 * types their address can set a password on their giving history. It is the
 * kind of regression that looks like a tidy-up in a diff.
 */

const findFirst = vi.fn()
const count = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findFirst: (...a: unknown[]) => findFirst(...a) },
    donation: { count: (...a: unknown[]) => count(...a) },
  },
}))

const { lookupEmail, assertEmailFree, ALREADY_HAVE_ACCOUNT } = await import('@/lib/account-check')

beforeEach(() => {
  findFirst.mockReset()
  count.mockReset()
  count.mockResolvedValue(0)
})

describe('lookupEmail', () => {
  it('sends a live account to sign in', async () => {
    findFirst.mockResolvedValue({ id: 'u1', name: 'Josh', passwordHash: 'x', isActive: true })
    await expect(lookupEmail('josh@example.com')).resolves.toMatchObject({ kind: 'account' })
  })

  it('treats a record with no password as history, not a new signup', async () => {
    // A donor row. Must never be offered an on-screen path forward.
    findFirst.mockResolvedValue({ id: 'u2', name: 'Pat', passwordHash: null, isActive: true })
    await expect(lookupEmail('pat@example.com')).resolves.toMatchObject({ kind: 'history' })
  })

  it('treats past giving with no user row as history', async () => {
    findFirst.mockResolvedValue(null)
    count.mockResolvedValue(3)
    await expect(lookupEmail('gave@example.com')).resolves.toMatchObject({ kind: 'history' })
  })

  it('treats a deactivated account as history rather than a live account', async () => {
    // Deactivated plus a password is not somewhere to sign in to, and it is
    // certainly not a free address.
    findFirst.mockResolvedValue({ id: 'u3', name: null, passwordHash: 'x', isActive: false })
    await expect(lookupEmail('gone@example.com')).resolves.toMatchObject({ kind: 'history' })
  })

  it('lets a genuinely unknown address sign up', async () => {
    findFirst.mockResolvedValue(null)
    await expect(lookupEmail('new@example.com')).resolves.toEqual({ kind: 'new' })
  })

  it('looks up case-insensitively, so a capital cannot make a second account', async () => {
    findFirst.mockResolvedValue(null)
    await lookupEmail('  Josh@Example.COM ')
    const where = findFirst.mock.calls[0][0].where
    expect(where.email.equals).toBe('josh@example.com')
    expect(where.email.mode).toBe('insensitive')
  })
})

describe('assertEmailFree', () => {
  it('refuses an email that already has an account', async () => {
    findFirst.mockResolvedValue({ id: 'u1' })
    await expect(assertEmailFree('josh@example.com')).resolves.toBe(ALREADY_HAVE_ACCOUNT)
  })

  it('refuses a row with NO password — the case that protects giving history', async () => {
    findFirst.mockResolvedValue({ id: 'u2' })
    await expect(assertEmailFree('pat@example.com')).resolves.toBe(ALREADY_HAVE_ACCOUNT)
  })

  it('allows a genuinely free address', async () => {
    findFirst.mockResolvedValue(null)
    await expect(assertEmailFree('new@example.com')).resolves.toBeNull()
  })

  it('is case-insensitive', async () => {
    findFirst.mockResolvedValue(null)
    await assertEmailFree('Pat@Example.com')
    expect(findFirst.mock.calls[0][0].where.email.mode).toBe('insensitive')
  })
})
