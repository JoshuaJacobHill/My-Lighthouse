'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canPreviewSlh } from '@/lib/features'
import { activeProgram, canOpenSlhOrg, shopperCapacity } from '@/lib/slh'
import { canSubmit, clampRequest, cleanAge, cleanCount, cleanGender } from '@/lib/slh-onboarding'
import { WISH_STEPS, ageOn, stepField, type WishStepKey } from '@/lib/slh-steps'
import { planAssignments } from '@/lib/slh-admin'
import { cleanBand, cleanInterests } from '@/lib/slh-wishlist'
import { bannedMessage, bannedTermIn, parseTerms } from '@/lib/wishlist-limits'
import { BANNED_TERMS_KEY, bannedTerms } from '@/lib/wishlist-limits.server'
import { formatDay, parseDays, withinWindow } from '@/lib/slh-dropoff'

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

/**
 * One child as the nomination form sends them.
 *
 * The wish list arrives with the nomination now rather than only afterwards —
 * an organisation filling it in themselves has the answers in front of them,
 * and making them save, find the child and open a second screen loses lists.
 * All of it is optional: a nomination with nothing but a name and a birthday
 * is normal and the rest is filled in later.
 */
type ChildInput = {
  firstName?: string
  dateOfBirth?: string
  gender?: string
  favouriteColour?: string
  clothesBand?: string
  topSize?: string
  bottomSize?: string
  dressSize?: string
  clothesSize?: string
  shoesBand?: string
  shoesSize?: string
  interests?: unknown
  wishWant?: string
  wishNeed?: string
  wishWear?: string
  wishRead?: string
  storyText?: string
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
    const text = (raw: unknown, max = 200) => String(raw ?? '').trim().slice(0, max) || null

    return [
      {
        firstName,
        dateOfBirth: dob,
        gender,
        favouriteColour: text(c.favouriteColour, 40),
        clothesBand: cleanBand(c.clothesBand),
        topSize: text(c.topSize, 40),
        bottomSize: text(c.bottomSize, 40),
        dressSize: text(c.dressSize, 40),
        clothesSize: text(c.clothesSize, 40),
        shoesBand: cleanBand(c.shoesBand),
        shoesSize: text(c.shoesSize, 40),
        interests: cleanInterests(c.interests),
        wishWant: text(c.wishWant),
        wishNeed: text(c.wishNeed),
        wishWear: text(c.wishWear),
        wishRead: text(c.wishRead),
        storyText: text(c.storyText, 1200),
        // Never arrives approved. Words collected by an organisation have not
        // been read by us yet, whoever typed them in.
        storyApproved: false,
      },
    ]
  })

  if (children.length === 0) {
    return { success: false, error: 'Add at least one child with a name, birthday and gender.' }
  }

  // A wish list can arrive with the nomination, so it is checked here too.
  const terms = await bannedTerms()
  for (const child of children) {
    for (const wish of [child.wishWant, child.wishNeed, child.wishWear, child.wishRead]) {
      const hit = bannedTermIn(String(wish ?? ''), terms)
      if (hit) {
        return { success: false, error: `${child.firstName}: ${bannedMessage(hit)}` }
      }
    }
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
      // Why they were nominated is a household fact. It lands on the family,
      // or — for a child in residential or kinship care, who has no family
      // row — on the child, because the reason exists either way.
      const why = String(formData.get('nominationNote') ?? '').trim().slice(0, 2000) || null

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
                notes: why,
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
          nominationNote: familyId ? null : why,
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

/**
 * Fill in (or correct) a child's wish list.
 *
 * The organisation's job, not the shopper's. Guarded by `canOpenSlhOrg` and
 * then checked again against the child's own organisation — an admin of one
 * referrer must not be able to edit another's child by guessing an id.
 *
 * The story is deliberately **not** approvable here. An organisation writing a
 * child's words down is not the same as Lighthouse having read them, and
 * editing the text un-approves it again: an approved story that is then
 * rewritten has not been read in its new form.
 */
export async function saveWishListAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in.' }

  const organisationId = String(formData.get('organisationId') ?? '')
  if (!(await canOpenSlhOrg(organisationId))) return { success: false, error: 'Not allowed.' }

  const childId = String(formData.get('childId') ?? '')
  const child = await prisma.giftChild.findFirst({
    where: { id: childId, organisationId },
    select: { id: true, storyText: true },
  })
  if (!child) return { success: false, error: 'No such child here.' }

  let interests: string[] = []
  try {
    interests = cleanInterests(JSON.parse(String(formData.get('interests') ?? '[]')))
  } catch {
    return { success: false, error: 'Could not read the interests.' }
  }

  const text = (raw: FormDataEntryValue | null, max = 200) =>
    String(raw ?? '').trim().slice(0, max) || null

  // Checked before anything is written. A list asking for a PlayStation puts a
  // shopper in an impossible position in December; catching it here means the
  // family is asked again while there is still time.
  const terms = await bannedTerms()
  for (const field of ['wishWant', 'wishNeed', 'wishWear', 'wishRead'] as const) {
    const hit = bannedTermIn(String(formData.get(field) ?? ''), terms)
    if (hit) return { success: false, error: bannedMessage(hit) }
  }

  const storyText = text(formData.get('storyText'), 1200)
  const storyChanged = (storyText ?? '') !== (child.storyText ?? '')

  try {
    await prisma.giftChild.update({
      where: { id: child.id },
      data: {
        favouriteColour: text(formData.get('favouriteColour'), 40),
        clothesBand: cleanBand(formData.get('clothesBand')),
        topSize: text(formData.get('topSize'), 40),
        bottomSize: text(formData.get('bottomSize'), 40),
        dressSize: text(formData.get('dressSize'), 40),
        clothesSize: text(formData.get('clothesSize'), 40),
        shoesBand: cleanBand(formData.get('shoesBand')),
        shoesSize: text(formData.get('shoesSize'), 40),
        interests,
        wishWant: text(formData.get('wishWant')),
        wishNeed: text(formData.get('wishNeed')),
        wishWear: text(formData.get('wishWear')),
        wishRead: text(formData.get('wishRead')),
        storyText,
        // Rewritten words have not been read in their new form.
        ...(storyChanged ? { storyApproved: false } : {}),
      },
    })
    revalidatePath(`/dashboard/slh/org/${organisationId}`)
    revalidatePath(`/dashboard/slh/org/${organisationId}/child/${child.id}`)
    return { success: true }
  } catch (err) {
    console.error('saveWishListAction failed', err)
    return { success: false, error: 'Could not save that wish list.' }
  }
}

/**
 * Approve a child's story for shoppers to read.
 *
 * Lighthouse only. A child writing freely may say something identifying or
 * distressing, and the organisation that collected it is not a second pair of
 * eyes — it is the first pair.
 */
export async function setStoryApprovedAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const childId = String(formData.get('childId') ?? '')
  const approved = String(formData.get('approved') ?? '') === 'true'

  try {
    const child = await prisma.giftChild.update({
      where: { id: childId },
      data: { storyApproved: approved },
      select: { organisationId: true },
    })
    revalidatePath(`/dashboard/slh/org/${child.organisationId}/child/${childId}`)
    return { success: true }
  } catch (err) {
    console.error('setStoryApprovedAction failed', err)
    return { success: false, error: 'Could not change that.' }
  }
}

/**
 * Where and when gifts are dropped off.
 *
 * Set by the organisation itself — they are the ones who know which days they
 * have somebody on the desk — and by Lighthouse. Both reach it through
 * `canOpenSlhOrg`.
 *
 * Lives on the enrolment rather than the organisation because a corporate
 * partner has no drop-off at all, and because a referrer often takes gifts
 * somewhere that is not their office.
 */
export async function setDeliveryAction(formData: FormData): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in.' }

  const organisationId = String(formData.get('organisationId') ?? '')
  if (!(await canOpenSlhOrg(organisationId))) return { success: false, error: 'Not allowed.' }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  const opensAt = asDateOnly(String(formData.get('opensAt') ?? '').trim())
  const closesAt = asDateOnly(String(formData.get('closesAt') ?? '').trim())

  if (opensAt && closesAt && closesAt < opensAt) {
    return { success: false, error: 'The last day cannot be before the first.' }
  }

  let days: string[] = []
  try {
    const raw = JSON.parse(String(formData.get('days') ?? '[]'))
    if (Array.isArray(raw)) {
      // Parsed rather than trusted: unreadable entries and impossible hours
      // are dropped, and only days inside the window survive — a window
      // somebody shortened must not leave a day advertised outside it.
      const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
      days = withinWindow(
        parseDays(raw.map((d) => String(d))),
        iso(opensAt),
        iso(closesAt),
      ).map(formatDay)
    }
  } catch {
    return { success: false, error: 'Could not read the drop-off days.' }
  }

  try {
    await prisma.giftProgramPartner.update({
      where: { programId_organisationId: { programId: program.id, organisationId } },
      data: {
        dropOffAddress: String(formData.get('address') ?? '').trim() || null,
        dropOffOpensAt: opensAt,
        dropOffClosesAt: closesAt,
        dropOffDays: days,
      },
    })
    revalidatePath(`/dashboard/slh/org/${organisationId}`)
    revalidatePath('/dashboard/slh')
    revalidatePath('/dashboard/slh/join')
    return { success: true }
  } catch (err) {
    console.error('setDeliveryAction failed', err)
    return { success: false, error: 'Could not save the drop-off details.' }
  }
}

/**
 * The program's own settings: what it is called, and when nominations close.
 *
 * `nominationsCloseAt` had no screen at all until now — the button that starts
 * a program asked nothing, so every organisation's page said "you can nominate
 * N more children" with no deadline attached. That date is the most useful
 * field on the row and nothing was setting it.
 */
export async function updateProgramAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  if (!name) return { success: false, error: 'The program needs a name.' }

  const closesRaw = String(formData.get('nominationsCloseAt') ?? '').trim()
  const nominationsCloseAt = closesRaw ? asDateOnly(closesRaw) : null
  if (closesRaw && !nominationsCloseAt) {
    return { success: false, error: 'That closing date could not be read.' }
  }

  try {
    await prisma.giftProgram.update({
      where: { id: program.id },
      data: { name, nominationsCloseAt },
    })
    revalidatePath('/admin/slh')
    revalidatePath('/admin/slh/organisations')
    return { success: true }
  } catch (err) {
    console.error('updateProgramAction failed', err)
    return { success: false, error: 'Could not save the program.' }
  }
}

/**
 * Add to the banned-item list.
 *
 * Adds only. The defaults in `wishlist-limits.ts` stay whatever is typed here,
 * so nobody can un-ban a PlayStation by clearing a text box — which is exactly
 * the kind of quiet failure that surfaces in December, holding a wish list
 * nobody can fulfil.
 */
export async function setBannedTermsAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const terms = parseTerms(String(formData.get('terms') ?? ''))

  try {
    await prisma.appSetting.upsert({
      where: { key: BANNED_TERMS_KEY },
      create: {
        key: BANNED_TERMS_KEY,
        value: terms.join('\n'),
        label: 'Santa’s Little Helpers — extra banned wish list items',
        group: 'slh',
      },
      update: { value: terms.join('\n') },
    })
    revalidatePath('/admin/slh')
    return { success: true }
  } catch (err) {
    console.error('setBannedTermsAction failed', err)
    return { success: false, error: 'Could not save that list.' }
  }
}

/* ── Handing lists out ─────────────────────────────────────────────────────── */

/**
 * Give specific wish lists to one shopper.
 *
 * Scoped to the shopper's own organisation and to children nobody else holds,
 * checked in the write rather than before it — two people doing this at once
 * is exactly when a stale page hands the same child to two shoppers.
 */
export async function assignChildrenAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const shopperId = String(formData.get('shopperId') ?? '')
  let childIds: string[] = []
  try {
    const raw = JSON.parse(String(formData.get('childIds') ?? '[]'))
    if (Array.isArray(raw)) childIds = raw.map((id) => String(id))
  } catch {
    return { success: false, error: 'Could not read that selection.' }
  }
  if (!shopperId || childIds.length === 0) return { success: false, error: 'Nothing to assign.' }

  const shopper = await prisma.giftShopper.findUnique({ where: { id: shopperId } })
  if (!shopper) return { success: false, error: 'No such shopper.' }

  try {
    const { count } = await prisma.giftChild.updateMany({
      where: {
        id: { in: childIds },
        organisationId: shopper.organisationId,
        // Only children nobody is already holding.
        shopperId: null,
      },
      data: { shopperId: shopper.id },
    })

    revalidatePath('/admin/slh/wishlists')
    revalidatePath('/admin/slh/shoppers')
    revalidatePath(`/admin/slh/shoppers/${shopper.id}`)

    if (count === 0) {
      return { success: false, error: 'Those lists have already been given to somebody else.' }
    }
    if (count < childIds.length) {
      return {
        success: true,
        error: `${childIds.length - count} of those had already been taken.`,
      }
    }
    return { success: true }
  } catch (err) {
    console.error('assignChildrenAction failed', err)
    return { success: false, error: 'Could not assign those.' }
  }
}

/**
 * Take wish lists back off whoever is holding them.
 *
 * Clears the steps with it, because the next shopper has not shopped or
 * wrapped anything and inheriting somebody else's ticks would tell them they
 * had. Same reasoning as a shopper handing one back themselves.
 */
export async function unassignChildrenAction(formData: FormData): Promise<Result> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  let childIds: string[] = []
  try {
    const raw = JSON.parse(String(formData.get('childIds') ?? '[]'))
    if (Array.isArray(raw)) childIds = raw.map((id) => String(id))
  } catch {
    return { success: false, error: 'Could not read that selection.' }
  }
  if (childIds.length === 0) return { success: false, error: 'Nothing selected.' }

  try {
    await prisma.giftChild.updateMany({
      where: { id: { in: childIds } },
      data: {
        shopperId: null,
        receivedAt: null,
        shoppedAt: null,
        wrappedAt: null,
        labelsAt: null,
        dropoffAt: null,
        deliveredAt: null,
      },
    })
    revalidatePath('/admin/slh/wishlists')
    revalidatePath('/admin/slh/shoppers')
    return { success: true }
  } catch (err) {
    console.error('unassignChildrenAction failed', err)
    return { success: false, error: 'Could not take those back.' }
  }
}

/**
 * Give these shoppers the lists they are waiting on.
 *
 * The matching step, run deliberately rather than on a timer. `planAssignments`
 * decides who gets what — fussy shoppers first, longest-waiting children
 * first, preferences never broken to make a number work — and this writes the
 * plan.
 *
 * Reports what it could NOT do as well as what it did. A shopper left short
 * because nobody matching their request is waiting is a fact somebody needs to
 * act on, not a silence.
 */
export async function fillShoppersAction(formData: FormData): Promise<
  Result & { assigned?: number; short?: number }
> {
  if (!(await requireLighthouseAdmin())) return { success: false, error: 'Not allowed.' }

  const program = await activeProgram()
  if (!program) return { success: false, error: 'No program is running.' }

  let shopperIds: string[] = []
  try {
    const raw = JSON.parse(String(formData.get('shopperIds') ?? '[]'))
    if (Array.isArray(raw)) shopperIds = raw.map((id) => String(id))
  } catch {
    return { success: false, error: 'Could not read that selection.' }
  }
  if (shopperIds.length === 0) return { success: false, error: 'Nobody selected.' }

  try {
    const shoppers = await prisma.giftShopper.findMany({
      where: { id: { in: shopperIds }, programId: program.id },
      include: { _count: { select: { children: true } } },
    })

    const waiting = await prisma.giftChild.findMany({
      where: {
        programId: program.id,
        shopperId: null,
        organisationId: { in: [...new Set(shoppers.map((s) => s.organisationId))] },
      },
      select: {
        id: true,
        organisationId: true,
        gender: true,
        dateOfBirth: true,
        createdAt: true,
      },
    })

    const plan = planAssignments(
      shoppers.map((s) => ({
        id: s.id,
        organisationId: s.organisationId,
        preferredAge: s.preferredAge,
        preferredGender: s.preferredGender,
        wants: Math.max(0, s.requested - s._count.children),
      })),
      waiting.map((c) => ({
        id: c.id,
        organisationId: c.organisationId,
        gender: c.gender,
        age: ageOn(c.dateOfBirth),
        nominatedAt: c.createdAt.getTime(),
      })),
    )

    let assigned = 0
    await prisma.$transaction(
      plan.map((p) => {
        assigned += p.childIds.length
        return prisma.giftChild.updateMany({
          where: { id: { in: p.childIds }, shopperId: null },
          data: { shopperId: p.shopperId },
        })
      }),
    )

    const wanted = shoppers.reduce(
      (n, s) => n + Math.max(0, s.requested - s._count.children),
      0,
    )

    revalidatePath('/admin/slh/shoppers')
    revalidatePath('/admin/slh/wishlists')

    return {
      success: true,
      assigned,
      short: Math.max(0, wanted - assigned),
    }
  } catch (err) {
    console.error('fillShoppersAction failed', err)
    return { success: false, error: 'Could not hand those out.' }
  }
}
