import prisma from '@/lib/prisma'

/**
 * Finding and storing accounts by email.
 *
 * Email addresses are case insensitive in practice, but a database unique index
 * is not: `Harrison@gmail.com` and `harrison@gmail.com` are two different
 * strings and Postgres will happily keep both. That is exactly how one
 * volunteer ended up with two accounts, his shift history on one and the
 * password on the other.
 *
 * So every path that creates an account goes through here: store the address
 * lowercased, and look for an existing one without regard to case.
 */

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export interface ExistingUser {
  id: string
  email: string
  passwordHash: string | null
}

/** The account for this address, whatever case it happens to be stored in. */
export async function findUserByEmail(email: string): Promise<ExistingUser | null> {
  const value = normaliseEmail(email)
  if (!value) return null
  return prisma.user.findFirst({
    where: { email: { equals: value, mode: 'insensitive' } },
    select: { id: true, email: true, passwordHash: true },
  })
}

/** True when an account already exists for this address. */
export async function emailIsTaken(email: string): Promise<boolean> {
  return (await findUserByEmail(email)) !== null
}
