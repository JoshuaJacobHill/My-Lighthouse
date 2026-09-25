'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { possibleDuplicates } from '@/lib/households'
import {
  HOUSEHOLD_STATUSES,
  RELATIONSHIPS,
  SUPPORT_KINDS,
  oneOfOrNull,
} from '@/lib/households-core'

/**
 * Writing to a household record.
 *
 * Every action re-checks `care.families` for itself. A server action can be
 * called directly, and a page that hides a button is a suggestion rather than
 * a guard.
 *
 * Nothing here deletes a household. Closing one is a status, because a family
 * who asked us to stop is not the same as a family who never existed, and the
 * record still has to be findable if they come back. Actual erasure belongs to
 * the retention rule — see docs/features/FAMILIES.md.
 */
type Result = { success: boolean; error?: string; id?: string }

async function guard(): Promise<boolean> {
  return hasCapability('care.families')
}

const text = (raw: FormDataEntryValue | null, max = 200) =>
  String(raw ?? '').trim().slice(0, max) || null

/** `@db.Date` wants a calendar day at midnight UTC. See docs/DATA.md. */
function asDateOnly(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function saveHouseholdAction(formData: FormData): Promise<Result> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  const session = await getSession()

  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  if (!name) return { success: false, error: 'Who are they? A name is needed.' }

  const data = {
    name,
    address: text(formData.get('address')),
    suburb: text(formData.get('suburb'), 80),
    postcode: text(formData.get('postcode'), 10),
    phone: text(formData.get('phone'), 40),
    email: text(formData.get('email'), 160),
    standingNotes: text(formData.get('standingNotes'), 2000),
    status: (oneOfOrNull(
      formData.get('status'),
      HOUSEHOLD_STATUSES.map(([v]) => v),
    ) ?? 'ACTIVE') as 'ACTIVE',
  }

  // Consent is a timestamp and a person, not a tick: we hold a record about a
  // family who came to us for food, and they should know it exists.
  const consented = String(formData.get('consent') ?? '') === 'true'

  const id = String(formData.get('id') ?? '')

  try {
    if (id) {
      const existing = await prisma.household.findUnique({
        where: { id },
        select: { consentAt: true },
      })
      if (!existing) return { success: false, error: 'No such household.' }

      await prisma.household.update({
        where: { id },
        data: {
          ...data,
          // Recorded once. Re-saving the form does not re-date somebody's
          // consent, and unticking it withdraws rather than rewrites.
          ...(consented
            ? existing.consentAt
              ? {}
              : { consentAt: new Date(), consentByName: session?.user.name ?? null }
            : { consentAt: null, consentByName: null }),
        },
      })
      revalidatePath(`/admin/families/${id}`)
      revalidatePath('/admin/families')
      return { success: true, id }
    }

    const created = await prisma.household.create({
      data: {
        ...data,
        ...(consented ? { consentAt: new Date(), consentByName: session?.user.name ?? null } : {}),
        createdById: session?.userId ?? null,
      },
      select: { id: true },
    })
    revalidatePath('/admin/families')
    return { success: true, id: created.id }
  } catch (err) {
    console.error('saveHouseholdAction failed', err)
    return { success: false, error: 'Could not save that household.' }
  }
}

export async function saveMemberAction(formData: FormData): Promise<Result> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }

  const householdId = String(formData.get('householdId') ?? '')
  const firstName = String(formData.get('firstName') ?? '').trim().slice(0, 80)
  if (!householdId || !firstName) return { success: false, error: 'A first name is needed.' }

  const dobRaw = String(formData.get('dateOfBirth') ?? '').trim()
  const dateOfBirth = dobRaw ? asDateOnly(dobRaw) : null
  if (dobRaw && !dateOfBirth) return { success: false, error: 'That date could not be read.' }

  const data = {
    firstName,
    lastName: text(formData.get('lastName'), 80),
    dateOfBirth,
    relationship: (oneOfOrNull(
      formData.get('relationship'),
      RELATIONSHIPS.map(([v]) => v),
    ) ?? 'ADULT') as 'ADULT',
    notes: text(formData.get('notes'), 1000),
    isPrimary: String(formData.get('isPrimary') ?? '') === 'true',
  }

  const id = String(formData.get('id') ?? '')

  try {
    if (data.isPrimary) {
      // One primary contact. Setting a new one stands the old one down rather
      // than leaving two people who both think they are the contact.
      await prisma.householdMember.updateMany({
        where: { householdId, ...(id ? { id: { not: id } } : {}) },
        data: { isPrimary: false },
      })
    }

    if (id) {
      await prisma.householdMember.update({ where: { id }, data })
    } else {
      await prisma.householdMember.create({ data: { ...data, householdId } })
    }
    revalidatePath(`/admin/families/${householdId}`)
    return { success: true }
  } catch (err) {
    console.error('saveMemberAction failed', err)
    return { success: false, error: 'Could not save that person.' }
  }
}

export async function removeMemberAction(formData: FormData): Promise<Result> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }

  const id = String(formData.get('id') ?? '')
  try {
    const row = await prisma.householdMember.delete({
      where: { id },
      select: { householdId: true },
    })
    revalidatePath(`/admin/families/${row.householdId}`)
    return { success: true }
  } catch (err) {
    console.error('removeMemberAction failed', err)
    return { success: false, error: 'Could not remove that person.' }
  }
}

/**
 * Record something given.
 *
 * The row the whole database exists to hold. Dated, because "has this family
 * had a trolley this month" is the question that makes distribution fair, and
 * it cannot be answered by anything else in the app.
 */
export async function recordSupportAction(formData: FormData): Promise<Result> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }
  const session = await getSession()

  const householdId = String(formData.get('householdId') ?? '')
  const kind = oneOfOrNull(
    formData.get('kind'),
    SUPPORT_KINDS.map(([v]) => v),
  )
  if (!householdId || !kind) return { success: false, error: 'What was given?' }

  const givenRaw = String(formData.get('givenAt') ?? '').trim()
  const givenAt = givenRaw ? asDateOnly(givenRaw) : new Date()
  if (givenRaw && !givenAt) return { success: false, error: 'That date could not be read.' }

  const quantityRaw = Number(String(formData.get('quantity') ?? '1'))
  const quantity = Number.isFinite(quantityRaw)
    ? Math.max(1, Math.min(50, Math.round(quantityRaw)))
    : 1

  try {
    await prisma.supportGiven.create({
      data: {
        householdId,
        kind: kind as 'FREE_TROLLEY',
        givenAt: givenAt ?? new Date(),
        quantity,
        notes: text(formData.get('notes'), 1000),
        recordedById: session?.userId ?? null,
      },
    })
    revalidatePath(`/admin/families/${householdId}`)
    revalidatePath('/admin/families')
    return { success: true }
  } catch (err) {
    console.error('recordSupportAction failed', err)
    return { success: false, error: 'Could not record that.' }
  }
}

/**
 * Undo a mistyped entry.
 *
 * Deletes rather than reverses, because this is a data-entry slip and not a
 * fact about a family — a trolley recorded against the wrong household should
 * leave no trace on either of them.
 */
export async function removeSupportAction(formData: FormData): Promise<Result> {
  if (!(await guard())) return { success: false, error: 'Not allowed.' }

  const id = String(formData.get('id') ?? '')
  try {
    const row = await prisma.supportGiven.delete({
      where: { id },
      select: { householdId: true },
    })
    revalidatePath(`/admin/families/${row.householdId}`)
    return { success: true }
  } catch (err) {
    console.error('removeSupportAction failed', err)
    return { success: false, error: 'Could not remove that.' }
  }
}

/**
 * Possible duplicates, as a server action the form can call while somebody
 * types. Read-only, and guarded like everything else here.
 */
export async function findDuplicatesAction(input: {
  name?: string
  phone?: string
  email?: string
  excludeId?: string
}): Promise<{ id: string; name: string; suburb: string | null; why: string }[]> {
  if (!(await guard())) return []
  return possibleDuplicates(input)
}
