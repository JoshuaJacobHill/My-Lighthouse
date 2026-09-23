/**
 * Santa's Little Helpers, on the partner organisations that already exist.
 *
 * A referring agency is not a new kind of thing. `Organisation` already holds a
 * name, a logo, a blurb and a set of members who sign in — which is exactly
 * what Village Connect needs — so this widens that rather than building a
 * second org concept beside it. Wesley Mission can refer children *and* sponsor
 * an event; a `type` column would have forced a choice.
 *
 * What is genuinely new is the **link** between an organisation and a program:
 * how many children they may nominate, where the gifts are taken, and the
 * window they are taken in. None of that belongs on `Organisation` — a
 * corporate partner has no drop-off window — so it lives on `GiftProgramPartner`.
 *
 * That row is also the **approval**. Having an account does not make an
 * organisation a referrer; Lighthouse picking it does. There is no `approved`
 * flag to forget to set — the row's existence is the decision, which is why
 * every read here starts from the join table rather than from `Organisation`.
 */
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canAdminOrg } from '@/lib/organisations'
import { canPreviewSlh } from '@/lib/features'
import { WISH_STEPS, doneCount } from '@/lib/slh-steps'

export type SlhOrgSummary = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  members: number
  allocation: number
  /** Whether this person administers it, rather than just being able to see it. */
  mine: boolean
}

/** The program everything currently hangs off. One at a time, for now. */
export async function activeProgram() {
  return prisma.giftProgram.findFirst({
    where: { isActive: true },
    orderBy: { year: 'desc' },
  })
}

/**
 * Organisations **approved to refer** to the active program.
 *
 * Being a partner organisation is not the same as being a referrer. Good Food
 * is a corporate partner and has no business appearing here; what puts an
 * organisation in this list is a `GiftProgramPartner` row, which is Lighthouse
 * approving them. The absence of that row is the whole point.
 */
export async function slhOrgsForViewer(): Promise<SlhOrgSummary[]> {
  const session = await getSession()
  if (!session) return []

  const program = await activeProgram()
  if (!program) return []

  const mine = await prisma.orgMember.findMany({
    where: { userId: session.userId, status: 'ACTIVE', role: 'ADMIN' },
    select: { organisationId: true },
  })
  const mineIds = new Set(mine.map((m) => m.organisationId))

  const enrolled = await prisma.giftProgramPartner.findMany({
    where: {
      programId: program.id,
      // A referrer sees their own; Lighthouse sees every one it approved.
      ...(canPreviewSlh(session.user) ? {} : { organisationId: { in: [...mineIds] } }),
    },
    orderBy: { organisation: { name: 'asc' } },
    select: {
      allocation: true,
      organisation: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          _count: { select: { members: true } },
        },
      },
    },
  })

  return enrolled.map((e) => ({
    id: e.organisation.id,
    name: e.organisation.name,
    slug: e.organisation.slug,
    logoUrl: e.organisation.logoUrl,
    members: e.organisation._count.members,
    allocation: e.allocation,
    mine: mineIds.has(e.organisation.id),
  }))
}

/**
 * Organisations that could be approved but have not been.
 *
 * Every organisation with an account, minus the ones already enrolled. This is
 * the list Lighthouse picks from, and picking is the approval.
 */
export async function orgsAvailableToEnrol(): Promise<
  { id: string; name: string; logoUrl: string | null; members: number }[]
> {
  const program = await activeProgram()
  if (!program) return []

  const orgs = await prisma.organisation.findMany({
    where: { giftPrograms: { none: { programId: program.id } } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, logoUrl: true, _count: { select: { members: true } } },
  })
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    logoUrl: o.logoUrl,
    members: o._count.members,
  }))
}

/** The enrolment itself, or null if this organisation was never approved. */
export async function enrolment(organisationId: string) {
  const program = await activeProgram()
  if (!program) return null
  return prisma.giftProgramPartner.findUnique({
    where: { programId_organisationId: { programId: program.id, organisationId } },
  })
}

/**
 * May this person open the program area for this organisation?
 *
 * `canAdminOrg` is the real answer and stays the real answer. The preview
 * clause is scaffolding: it lets a super admin walk the screens before any
 * organisation has been enrolled in the program, and it comes out with the rest
 * of the preview gating.
 */
export async function canOpenSlhOrg(organisationId: string): Promise<boolean> {
  // Approval first. An organisation nobody enrolled has no program area to
  // open, however senior the person asking.
  if (!(await enrolment(organisationId))) return false

  if (await canAdminOrg(organisationId)) return true
  const session = await getSession()
  return Boolean(session && canPreviewSlh(session.user))
}

export async function slhOrg(organisationId: string) {
  return prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { id: true, name: true, slug: true, logoUrl: true, about: true, status: true },
  })
}

/* ── Shoppers ──────────────────────────────────────────────────────────────
 *
 * The other half of the program. A `GiftShopper` row is somebody who has been
 * through onboarding; its absence is why the join flow appears.
 */

/** This person's sign-up for the active program, or null if they have not. */
export async function myShopper() {
  const session = await getSession()
  if (!session) return null

  const program = await activeProgram()
  if (!program) return null

  return prisma.giftShopper.findUnique({
    where: { programId_userId: { programId: program.id, userId: session.userId } },
    include: { organisation: { select: { id: true, name: true, slug: true } } },
  })
}

export type ShopperOrgOption = {
  id: string
  name: string
  logoUrl: string | null
  allocation: number
  /** Children nominated but not yet handed to a shopper. */
  waiting: number
  /** Wish lists still to be promised: allocation minus what shoppers asked for. */
  available: number
  /** False when no allocation is set — "come back later", not "all taken". */
  open: boolean
  dropOffAddress: string | null
  dropOffOpensAt: Date | null
  dropOffClosesAt: Date | null
}

/**
 * The organisations a shopper may choose between.
 *
 * Only approved ones, and only what a supporter needs to decide: who they are,
 * how many children are still waiting, and whether they can get to the
 * drop-off. `waiting` is counted, not estimated — an organisation with nobody
 * waiting still appears, because a shopper choosing it is how the next
 * nomination gets picked up.
 */
export async function orgsOpenToShoppers(): Promise<ShopperOrgOption[]> {
  const program = await activeProgram()
  if (!program) return []

  const partners = await prisma.giftProgramPartner.findMany({
    where: { programId: program.id },
    orderBy: { organisation: { name: 'asc' } },
    select: {
      allocation: true,
      dropOffAddress: true,
      dropOffOpensAt: true,
      dropOffClosesAt: true,
      organisation: { select: { id: true, name: true, logoUrl: true } },
    },
  })
  if (partners.length === 0) return []

  const [waiting, committed] = await Promise.all([
    prisma.giftChild.groupBy({
      by: ['organisationId'],
      where: { programId: program.id, shopperId: null },
      _count: { _all: true },
    }),
    // What every shopper has already asked for, per organisation. One query
    // rather than one per card.
    prisma.giftShopper.groupBy({
      by: ['organisationId'],
      where: { programId: program.id },
      _sum: { requested: true },
    }),
  ])
  const waitingBy = new Map(waiting.map((w) => [w.organisationId, w._count._all]))
  const committedBy = new Map(committed.map((c) => [c.organisationId, c._sum.requested ?? 0]))

  return partners.map((p) => ({
    id: p.organisation.id,
    name: p.organisation.name,
    logoUrl: p.organisation.logoUrl,
    allocation: p.allocation,
    waiting: waitingBy.get(p.organisation.id) ?? 0,
    available: Math.max(0, p.allocation - (committedBy.get(p.organisation.id) ?? 0)),
    open: p.allocation > 0,
    dropOffAddress: p.dropOffAddress,
    dropOffOpensAt: p.dropOffOpensAt,
    dropOffClosesAt: p.dropOffClosesAt,
  }))
}

/** The wish lists handed to this person. Empty until a list is assigned. */
export async function myWishLists() {
  const shopper = await myShopper()
  if (!shopper) return []

  return prisma.giftChild.findMany({
    where: { shopperId: shopper.id },
    orderBy: { firstName: 'asc' },
  })
}

/**
 * One wish list, if it belongs to the person asking.
 *
 * Ownership is the rule, checked in the query rather than after it. A super
 * admin previewing gets a read-only look at any child in the program; that is
 * scaffolding, and it comes out with the rest of the preview gating.
 */
export async function wishListForViewer(childId: string) {
  const session = await getSession()
  if (!session) return null

  const shopper = await myShopper()
  if (shopper) {
    const mine = await prisma.giftChild.findFirst({
      where: { id: childId, shopperId: shopper.id },
      include: { organisation: { select: { id: true, name: true } } },
    })
    if (mine) return mine
  }

  if (!canPreviewSlh(session.user)) return null
  return prisma.giftChild.findUnique({
    where: { id: childId },
    include: { organisation: { select: { id: true, name: true } } },
  })
}

/* ── The organisation's side ───────────────────────────────────────────────── */

/** Families this organisation has nominated, with their children. */
export async function orgFamilies(organisationId: string) {
  const program = await activeProgram()
  if (!program) return []

  return prisma.giftFamily.findMany({
    where: { programId: program.id, organisationId },
    orderBy: { createdAt: 'desc' },
    include: { children: { orderBy: { firstName: 'asc' } } },
  })
}

/**
 * Children nominated without a family.
 *
 * Expected, not an error: residential and kinship care, where there is no
 * parent to fill the guardian details in.
 */
export async function orgLooseChildren(organisationId: string) {
  const program = await activeProgram()
  if (!program) return []

  return prisma.giftChild.findMany({
    where: { programId: program.id, organisationId, familyId: null },
    orderBy: { firstName: 'asc' },
  })
}

/** How many children this organisation has nominated, against its ceiling. */
export async function orgNominatedCount(organisationId: string): Promise<number> {
  const program = await activeProgram()
  if (!program) return 0

  return prisma.giftChild.count({ where: { programId: program.id, organisationId } })
}

/**
 * The dashboard card's one number.
 *
 * Returns null for somebody who has not signed up, which is what makes the
 * card say "join" rather than show a bar at 0% — an empty progress bar reads
 * as failure, and they have not failed at anything.
 */
export async function slhDashboardCard(): Promise<{
  organisation: string
  lists: number
  done: number
  total: number
} | null> {
  const shopper = await myShopper()
  if (!shopper) return null

  const children = await prisma.giftChild.findMany({
    where: { shopperId: shopper.id },
    select: {
      receivedAt: true,
      shoppedAt: true,
      wrappedAt: true,
      labelsAt: true,
      dropoffAt: true,
      deliveredAt: true,
    },
  })

  return {
    organisation: shopper.organisation.name,
    lists: children.length,
    done: children.reduce((n, c) => n + doneCount(c), 0),
    total: children.length * WISH_STEPS.length,
  }
}

export type Capacity = {
  /** The ceiling Lighthouse set for the organisation. 0 = not set yet. */
  allocation: number
  /** What every shopper has already asked for. */
  committed: number
  /** What is left to give away. */
  available: number
  /** False when the allocation has not been set, which is not the same as full. */
  open: boolean
}

/**
 * How many more wish lists an organisation can promise.
 *
 * Measured against the **allocation**, not the children actually nominated.
 * Shoppers sign up in October and organisations nominate through November, so
 * counting real children would tell an early shopper an organisation has
 * nothing for them when in fact it has forty coming.
 *
 * `exceptShopperId` leaves one shopper's own request out of the sum, so
 * somebody changing 3 to 4 is measured against everyone else rather than
 * competing with themselves.
 */
export async function shopperCapacity(
  organisationId: string,
  exceptShopperId?: string,
): Promise<Capacity> {
  const program = await activeProgram()
  if (!program) return { allocation: 0, committed: 0, available: 0, open: false }

  const [partner, agg] = await Promise.all([
    prisma.giftProgramPartner.findUnique({
      where: { programId_organisationId: { programId: program.id, organisationId } },
    }),
    prisma.giftShopper.aggregate({
      where: {
        programId: program.id,
        organisationId,
        ...(exceptShopperId ? { id: { not: exceptShopperId } } : {}),
      },
      _sum: { requested: true },
    }),
  ])

  const allocation = partner?.allocation ?? 0
  const committed = agg._sum.requested ?? 0

  return {
    allocation,
    committed,
    available: Math.max(0, allocation - committed),
    // An allocation of 0 means Lighthouse has not said how many children this
    // organisation may nominate. Nothing can be promised against a number
    // nobody has set, so it is closed rather than full — and the screens say so
    // differently, because "come back later" and "all taken" are not the same.
    open: allocation > 0,
  }
}
