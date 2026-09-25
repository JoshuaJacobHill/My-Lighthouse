/**
 * Reading and writing households.
 *
 * Every function here guards itself on `care.families` — the most sensitive
 * capability in the app. See `docs/features/FAMILIES.md` for what that carries
 * and what still has to be decided by a person before it holds real families.
 */
import prisma from '@/lib/prisma'
import { hasCapability } from '@/lib/permissions'
import { emailKey, phoneKey } from '@/lib/households-core'

/**
 * The one gate, asked as a capability rather than a role — and asked through
 * `permissions.ts` rather than rebuilt here, because the session user does not
 * carry the two opt-in switches that `can()` needs.
 */
export async function canReadFamilies(): Promise<boolean> {
  return hasCapability('care.families')
}

export type HouseholdRow = {
  id: string
  name: string
  suburb: string | null
  phone: string | null
  status: string
  members: { relationship: string }[]
  lastSupport: { kind: string; givenAt: Date } | null
  supportCount: number
}

/**
 * The list, searched.
 *
 * Name, suburb and phone, because those are the three things somebody has in
 * front of them when a family is standing at a counter or on the other end of
 * a call. The phone search strips punctuation on both sides — see `phoneKey`.
 */
export async function households(filters: {
  search?: string
  status?: string
}): Promise<HouseholdRow[]> {
  if (!(await canReadFamilies())) return []

  const search = filters.search?.trim()
  const digits = search ? phoneKey(search) : null

  const rows = await prisma.household.findMany({
    where: {
      ...(filters.status ? { status: filters.status as 'ACTIVE' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { suburb: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              // A typed number rarely matches the stored formatting, so
              // compare the tail digits instead of the string.
              ...(digits ? [{ phone: { contains: digits.slice(-6) } }] : []),
              {
                members: {
                  some: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' as const } },
                      { lastName: { contains: search, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 200,
    select: {
      id: true,
      name: true,
      suburb: true,
      phone: true,
      status: true,
      members: { select: { relationship: true } },
      _count: { select: { support: true } },
      support: { orderBy: { givenAt: 'desc' }, take: 1, select: { kind: true, givenAt: true } },
    },
  })

  return rows.map((h) => ({
    id: h.id,
    name: h.name,
    suburb: h.suburb,
    phone: h.phone,
    status: h.status,
    members: h.members,
    lastSupport: h.support[0] ?? null,
    supportCount: h._count.support,
  }))
}

/** One household, with everything on it. Null when not allowed or not there. */
export async function household(id: string) {
  if (!(await canReadFamilies())) return null

  return prisma.household.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: [{ isPrimary: 'desc' }, { dateOfBirth: 'asc' }],
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      support: {
        orderBy: { givenAt: 'desc' },
        include: { organisation: { select: { name: true } } },
      },
      notes: { orderBy: { createdAt: 'desc' } },
      referrals: { orderBy: { referredAt: 'desc' } },
      giftFamilies: {
        select: { id: true, program: { select: { name: true } }, _count: { select: { children: true } } },
      },
    },
  })
}

/**
 * When was this household last given each kind of support?
 *
 * The fairness question, answered per kind rather than as one date: a family
 * who had a Christmas hamper in December has not therefore had a trolley.
 */
export async function lastSupportByKind(householdId: string): Promise<Record<string, Date>> {
  if (!(await canReadFamilies())) return {}

  const rows = await prisma.supportGiven.groupBy({
    by: ['kind'],
    where: { householdId },
    _max: { givenAt: true },
  })

  const out: Record<string, Date> = {}
  for (const row of rows) {
    if (row._max.givenAt) out[row.kind] = row._max.givenAt
  }
  return out
}

/**
 * Households that look like the one being entered.
 *
 * Run before a new record is saved, not after. Two records of one family is
 * the failure mode that makes a database like this useless within a month,
 * and it happens because somebody typed a phone number differently.
 *
 * Deliberately returns candidates rather than blocking: people share a
 * surname and a suburb, and a service that refuses to record a second family
 * at one address is worse than one that asks.
 */
export async function possibleDuplicates(input: {
  name?: string
  phone?: string
  email?: string
  excludeId?: string
}): Promise<{ id: string; name: string; suburb: string | null; why: string }[]> {
  if (!(await canReadFamilies())) return []

  const digits = phoneKey(input.phone)
  const mail = emailKey(input.email)
  const name = input.name?.trim()
  if (!digits && !mail && !name) return []

  const rows = await prisma.household.findMany({
    where: {
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(digits ? [{ phone: { contains: digits.slice(-6) } }] : []),
        ...(mail ? [{ email: { equals: mail, mode: 'insensitive' as const } }] : []),
        ...(name ? [{ name: { equals: name, mode: 'insensitive' as const } }] : []),
      ],
    },
    take: 5,
    select: { id: true, name: true, suburb: true, phone: true, email: true },
  })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    suburb: row.suburb,
    why:
      digits && phoneKey(row.phone) === digits
        ? 'same phone number'
        : mail && emailKey(row.email) === mail
          ? 'same email'
          : 'same name',
  }))
}
