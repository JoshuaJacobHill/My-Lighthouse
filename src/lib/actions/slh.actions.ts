'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { activeProgram, canOpenSlhOrg, shopperCapacity } from '@/lib/slh'
import { canSubmit, clampRequest, cleanAge, cleanCount, cleanGender } from '@/lib/slh-onboarding'
import { WISH_STEPS, stepField, type WishStepKey } from '@/lib/slh-steps'

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

/**
 * Sign up to shop for children this Christmas.
 *
 * Unlike the actions above, this one is a person speaking for themselves, so
 * it needs a session rather than an approval — but the organisation still has
 * to be one Lighthouse approved. A supporter picking an organisation from a
 * list is not the same as a supporter being able to name any organisation.
 */
export async function joinAsShopperAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in.' }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  const organisationId = String(formData.get('organisationId') ?? '')
  const acknowledged = String(formData.get('acknowledged') ?? '') === 'true'
  if (!canSubmit({ organisationId, acknowledged })) {
    return { success: false, error: 'Pick an organisation and confirm the drop-off.' }
  }

  // The organisation must be approved for *this* program. Checked here rather
  // than trusted from the form: the list came from the server, but what comes
  // back is whatever the browser sent.
  const partner = await prisma.giftProgramPartner.findUnique({
    where: { programId_organisationId: { programId: program.id, organisationId } },
  })
  if (!partner) return { success: false, error: 'That organisation is not taking shoppers.' }

  // The allocation is a ceiling on promises, not just on nominations. Checked
  // here rather than trusted from the form: the page's copy of what is left can
  // be minutes old, and two people signing up at once is exactly when it
  // matters. An existing shopper's own request is excluded from the sum so
  // somebody changing their mind is not competing with themselves.
  const existing = await prisma.giftShopper.findUnique({
    where: { programId_userId: { programId: program.id, userId: session.userId } },
    select: { id: true },
  })
  const capacity = await shopperCapacity(organisationId, existing?.id)

  if (!capacity.open) {
    return { success: false, error: 'That organisation is not taking shoppers yet.' }
  }

  const requested = cleanCount(formData.get('requested'))
  if (requested > capacity.available) {
    return {
      success: false,
      error:
        capacity.available === 0
          ? 'Every wish list at that organisation has been taken. Please choose another.'
          : `Only ${capacity.available} wish ${capacity.available === 1 ? 'list is' : 'lists are'} left there.`,
    }
  }

  const data = {
    requested,
    preferredAge: cleanAge(formData.get('preferredAge')),
    preferredGender: cleanGender(formData.get('preferredGender')),
    organisationId,
    // Re-stamped on every submit: agreeing to a window that has since moved is
    // not the same as agreeing to the one showing now.
    acknowledgedAt: new Date(),
  }

  try {
    await prisma.giftShopper.upsert({
      where: { programId_userId: { programId: program.id, userId: session.userId } },
      update: data,
      create: { programId: program.id, userId: session.userId, ...data },
    })
    revalidatePath('/dashboard/slh')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('joinAsShopperAction failed', err)
    return { success: false, error: 'Could not save your sign-up.' }
  }
}

/**
 * Tick (or untick) a step on a wish list.
 *
 * Only the shopper the list was handed to. Not the organisation, not an admin
 * passing through — the steps are a record of what this person did, and
 * somebody else marking "gifts wrapped" on their behalf makes the record a
 * guess. `wishListForViewer` deliberately is not used here: it lets a super
 * admin *read* any list, and reading is not the same as writing.
 */
export async function markStepAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in.' }

  const childId = String(formData.get('childId') ?? '')
  const key = String(formData.get('step') ?? '') as WishStepKey
  if (!WISH_STEPS.some((s) => s.key === key)) {
    return { success: false, error: 'Unknown step.' }
  }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  const shopper = await prisma.giftShopper.findUnique({
    where: { programId_userId: { programId: program.id, userId: session.userId } },
  })
  if (!shopper) return { success: false, error: 'You are not shopping this year.' }

  const child = await prisma.giftChild.findFirst({
    where: { id: childId, shopperId: shopper.id },
  })
  if (!child) return { success: false, error: 'That is not one of your wish lists.' }

  const field = stepField(key)
  const on = String(formData.get('on') ?? '') === 'true'

  try {
    await prisma.giftChild.update({
      where: { id: child.id },
      data: { [field]: on ? new Date() : null },
    })
    revalidatePath('/dashboard/slh')
    revalidatePath(`/dashboard/slh/${child.id}`)
    return { success: true }
  } catch (err) {
    console.error('markStepAction failed', err)
    return { success: false, error: 'Could not save that step.' }
  }
}

/** One child as the nomination form sends them. */
type ChildInput = {
  firstName?: string
  dateOfBirth?: string
  gender?: string
  clothesSize?: string
  shoesSize?: string
}

/**
 * A `@db.Date` column wants a calendar day, not an instant.
 *
 * Built at midnight **UTC** on purpose: Prisma stores `@db.Date` that way, and
 * parsing "2015-06-01" in Brisbane would land at 14:00 the previous day and
 * hand back the wrong birthday. See docs/DATA.md.
 */
function asDateOnly(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Nominate a family, and their children, for this year's program.
 *
 * Guarded by `canOpenSlhOrg`, which means the organisation's own admins — this
 * is the one action here a referrer performs rather than Lighthouse.
 *
 * Children can arrive without a family: residential and kinship care, where
 * there is no parent to fill anything in. That is why the family row is created
 * conditionally rather than always.
 */
export async function addFamilyAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in.' }

  const organisationId = String(formData.get('organisationId') ?? '')
  if (!(await canOpenSlhOrg(organisationId))) {
    return { success: false, error: 'Not allowed.' }
  }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  let parsed: ChildInput[] = []
  try {
    const raw = JSON.parse(String(formData.get('children') ?? '[]'))
    if (Array.isArray(raw)) parsed = raw as ChildInput[]
  } catch {
    return { success: false, error: 'Could not read the children.' }
  }

  // A first name, a date of birth and a gender are the minimum a shopper needs
  // to be given somebody rather than a record. Everything else can follow.
  const children = parsed.flatMap((c) => {
    const firstName = String(c.firstName ?? '').trim()
    const dob = asDateOnly(String(c.dateOfBirth ?? '').trim())
    const gender = c.gender === 'girl' || c.gender === 'boy' ? c.gender : null
    if (!firstName || !dob || !gender) return []
    return [
      {
        firstName,
        dateOfBirth: dob,
        gender,
        clothesSize: String(c.clothesSize ?? '').trim() || null,
        shoesSize: String(c.shoesSize ?? '').trim() || null,
      },
    ]
  })

  if (children.length === 0) {
    return { success: false, error: 'Add at least one child with a name, birthday and gender.' }
  }

  // The allocation is a ceiling, not a suggestion. Checked here rather than in
  // the form, because the form's copy of the count can be minutes out of date.
  const partner = await prisma.giftProgramPartner.findUnique({
    where: { programId_organisationId: { programId: program.id, organisationId } },
  })
  if (partner && partner.allocation > 0) {
    const already = await prisma.giftChild.count({
      where: { programId: program.id, organisationId },
    })
    const room = partner.allocation - already
    if (children.length > room) {
      return {
        success: false,
        error:
          room <= 0
            ? 'Your allocation is full. Talk to Lighthouse before nominating more.'
            : `You have room for ${room} more ${room === 1 ? 'child' : 'children'}.`,
      }
    }
  }

  const guardianName = String(formData.get('guardianName') ?? '').trim()
  const consent = String(formData.get('consent') ?? '') === 'true'
  const noGuardian = String(formData.get('noGuardian') ?? '') === 'true'

  if (!noGuardian) {
    if (!guardianName) return { success: false, error: 'Who is the parent or guardian?' }
    // We will email and sometimes ring this family. "The organisation said it
    // was fine" is not the same as recording that somebody confirmed it.
    if (!consent) return { success: false, error: 'Please confirm the family has agreed.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const familyId = noGuardian
        ? null
        : (
            await tx.giftFamily.create({
              data: {
                programId: program.id,
                organisationId,
                guardianName,
                guardianEmail: String(formData.get('guardianEmail') ?? '').trim() || null,
                guardianPhone: String(formData.get('guardianPhone') ?? '').trim() || null,
                consentAt: new Date(),
                consentByName: session.user.name ?? null,
                createdById: session.userId,
              },
              select: { id: true },
            })
          ).id

      await tx.giftChild.createMany({
        data: children.map((c) => ({
          ...c,
          programId: program.id,
          organisationId,
          familyId,
          createdById: session.userId,
        })),
      })
    })

    revalidatePath(`/dashboard/slh/org/${organisationId}`)
    return { success: true }
  } catch (err) {
    console.error('addFamilyAction failed', err)
    return { success: false, error: 'Could not save that family.' }
  }
}

/**
 * Change how many wish lists you have asked for.
 *
 * Both directions. Somebody who finds they can manage two more should not have
 * to ring anybody, and somebody who realises in November that five was
 * ambitious needs to say so *then* — a shopper who quietly cannot finish is
 * how a child ends up without a present, so the path down has to be as easy as
 * the path up.
 *
 * Lists already assigned are the floor. Releasing those is
 * `releaseWishListAction`, which is a different and more deliberate act.
 */
export async function setRequestedAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in.' }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  const shopper = await prisma.giftShopper.findUnique({
    where: { programId_userId: { programId: program.id, userId: session.userId } },
  })
  if (!shopper) return { success: false, error: 'You have not signed up yet.' }

  const [capacity, held] = await Promise.all([
    shopperCapacity(shopper.organisationId, shopper.id),
    prisma.giftChild.count({ where: { shopperId: shopper.id } }),
  ])

  const wanted = clampRequest(formData.get('requested'), capacity.available)
  if (wanted < held) {
    return {
      success: false,
      error: `You are holding ${held} wish ${held === 1 ? 'list' : 'lists'}. Give one back first.`,
    }
  }

  try {
    await prisma.giftShopper.update({ where: { id: shopper.id }, data: { requested: wanted } })
    revalidatePath('/dashboard/slh')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('setRequestedAction failed', err)
    return { success: false, error: 'Could not change that.' }
  }
}

/**
 * Give a wish list back.
 *
 * The list returns to the pool for somebody else, and the shopper's request
 * drops by one so it is not handed straight back to them. Any steps they had
 * ticked are cleared: the next shopper has not shopped or wrapped anything,
 * and inheriting someone else's ticks would tell them they had.
 *
 * Only the shopper holding it. This is the thing the onboarding screen asks
 * people to do early, so it must be one button and no conversation.
 */
export async function releaseWishListAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in.' }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  const shopper = await prisma.giftShopper.findUnique({
    where: { programId_userId: { programId: program.id, userId: session.userId } },
  })
  if (!shopper) return { success: false, error: 'You are not shopping this year.' }

  const childId = String(formData.get('childId') ?? '')
  const child = await prisma.giftChild.findFirst({
    where: { id: childId, shopperId: shopper.id },
    select: { id: true },
  })
  if (!child) return { success: false, error: 'That is not one of your wish lists.' }

  try {
    await prisma.$transaction([
      prisma.giftChild.update({
        where: { id: child.id },
        data: {
          shopperId: null,
          receivedAt: null,
          shoppedAt: null,
          wrappedAt: null,
          labelsAt: null,
          dropoffAt: null,
          deliveredAt: null,
        },
      }),
      prisma.giftShopper.update({
        where: { id: shopper.id },
        data: { requested: Math.max(0, shopper.requested - 1) },
      }),
    ])
    revalidatePath('/dashboard/slh')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('releaseWishListAction failed', err)
    return { success: false, error: 'Could not give that list back.' }
  }
}
