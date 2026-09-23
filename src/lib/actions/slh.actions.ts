'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { activeProgram } from '@/lib/slh'

/**
 * Approving a referring organisation.
 *
 * Every action here is Lighthouse's decision, not the organisation's. A partner
 * cannot enrol itself, and being a corporate partner is not an application to
 * refer children — those are different relationships that happen to share an
 * `Organisation` row.
 *
 * Each action re-checks for itself. A server action can be called directly, and
 * a page that hides a button is a suggestion rather than a guard.
 */
type Result = { success: boolean; error?: string }

async function requireLighthouseAdmin(): Promise<boolean> {
  const session = await getSession()
  return Boolean(session && canPreviewSlh(session.user))
}

/** The ceiling has to be a sane whole number; 0 means "approved, not yet set". */
function cleanAllocation(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1000, Math.round(n)))
}

/** Create this year's program. Idempotent on the slug. */
export async function createGiftProgramAction(): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const year = new Date().getFullYear()
  const slug = `santas-little-helpers-${year}`
  try {
    const existing = await prisma.giftProgram.findUnique({ where: { slug } })
    if (!existing) {
      await prisma.giftProgram.create({
        data: { name: `Santa's Little Helpers ${year}`, slug, year, isActive: true },
      })
    }
    revalidatePath('/dashboard/slh/org')
    return { success: true }
  } catch (err) {
    console.error('createGiftProgramAction failed', err)
    return { success: false, error: 'Could not create the program.' }
  }
}

/**
 * Approve an organisation to refer children.
 *
 * The row *is* the approval — there is no separate flag — so creating it is the
 * decision and deleting it withdraws it.
 */
export async function enrolOrganisationAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const organisationId = String(formData.get('organisationId') ?? '')
  if (!organisationId) return { success: false, error: 'No organisation given.' }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  const session = await getSession()

  try {
    await prisma.giftProgramPartner.upsert({
      where: { programId_organisationId: { programId: program.id, organisationId } },
      update: {},
      create: {
        programId: program.id,
        organisationId,
        allocation: cleanAllocation(formData.get('allocation')),
        approvedById: session?.userId ?? null,
      },
    })
    revalidatePath('/dashboard/slh/org')
    return { success: true }
  } catch (err) {
    console.error('enrolOrganisationAction failed', err)
    return { success: false, error: 'Could not approve that organisation.' }
  }
}

/** Change how many children an organisation may nominate. */
export async function setAllocationAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const organisationId = String(formData.get('organisationId') ?? '')
  const program = await activeProgram()
  if (!program || !organisationId) return { success: false, error: 'Nothing to change.' }

  try {
    await prisma.giftProgramPartner.update({
      where: { programId_organisationId: { programId: program.id, organisationId } },
      data: { allocation: cleanAllocation(formData.get('allocation')) },
    })
    revalidatePath('/dashboard/slh/org')
    revalidatePath(`/dashboard/slh/org/${organisationId}`)
    return { success: true }
  } catch (err) {
    console.error('setAllocationAction failed', err)
    return { success: false, error: 'Could not change the allocation.' }
  }
}

/**
 * Withdraw an approval.
 *
 * Deletes the link and nothing else. The organisation, its members and its
 * partner profile are untouched — they were never part of this program, they
 * were only approved to refer to it.
 */
export async function removeEnrolmentAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const organisationId = String(formData.get('organisationId') ?? '')
  const program = await activeProgram()
  if (!program || !organisationId) return { success: false, error: 'Nothing to remove.' }

  try {
    await prisma.giftProgramPartner.delete({
      where: { programId_organisationId: { programId: program.id, organisationId } },
    })
    revalidatePath('/dashboard/slh/org')
    return { success: true }
  } catch (err) {
    console.error('removeEnrolmentAction failed', err)
    return { success: false, error: 'Could not remove that organisation.' }
  }
}
