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
import { WISH_STEPS, ageOn, doneCount } from '@/lib/slh-steps'
import { birthdayWindow } from '@/lib/slh-admin'
import { wishListReady } from '@/lib/slh-wishlist'

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

  // `nominationNote` is why a family needs help — bereavement, violence, a
  // parent in hospital. It is omitted at the query rather than left out of the
  // markup: a field that never leaves the database cannot be leaked by the
  // next person who adds a line to this page.
  const hide = { nominationNote: true } as const
  const org = { organisation: { select: { id: true, name: true } } }

  const shopper = await myShopper()
  if (shopper) {
    const mine = await prisma.giftChild.findFirst({
      where: { id: childId, shopperId: shopper.id },
      omit: hide,
      include: org,
    })
    if (mine) return mine
  }

  if (!canPreviewSlh(session.user)) return null
  return prisma.giftChild.findUnique({ where: { id: childId }, omit: hide, include: org })
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

/* ── Who is in the program ─────────────────────────────────────────────────── */

/** The enrolled organisations this person administers. Usually none, or one. */
export async function myProgramOrgIds(): Promise<string[]> {
  const session = await getSession()
  if (!session) return []

  const program = await activeProgram()
  if (!program) return []

  const rows = await prisma.giftProgramPartner.findMany({
    where: {
      programId: program.id,
      organisation: {
        members: { some: { userId: session.userId, status: 'ACTIVE', role: 'ADMIN' } },
      },
    },
    select: { organisationId: true },
  })
  return rows.map((r) => r.organisationId)
}

/**
 * May this person use the shopper side?
 *
 * **Anybody with an account, once a program is running.** Shopping for a child
 * is not an administrative privilege — it is the thing the program is asking
 * the public to do, and lighthousecare.org.au/santa points members of the
 * public straight at the sign-up flow.
 *
 * The gate that remains is the program itself. Before one is started there is
 * nothing to sign up to, and an empty onboarding flow is worse than an honest
 * absence: somebody who gets three screens in and finds no organisations has
 * been wasted, whereas somebody who never sees the card has lost nothing.
 *
 * Note what this is NOT: `canPreviewSlh` (`care.slh`) still guards everything
 * administrative — approving referrers, allocations, every shopper and every
 * wish list across the program. This opens the supporter's own door only.
 */
export async function canShopSlh(): Promise<boolean> {
  const session = await getSession()
  if (!session) return false
  return (await activeProgram()) !== null
}

export type ProgramOrgCard = {
  id: string
  name: string
  logoUrl: string | null
  allocation: number
  nominated: number
  /** Wish lists nobody has filled in yet — what they need to chase. */
  unfilled: number
}

/**
 * The dashboard card for an organisation's own program area.
 *
 * Separate from the shopper card, and both can appear for the same person.
 * That is the point of one account per person: somebody can administer 5 Fold
 * *and* shop for a child, and neither fact should hide the other.
 */
export async function myProgramOrgCards(): Promise<ProgramOrgCard[]> {
  const ids = await myProgramOrgIds()
  if (ids.length === 0) return []

  const program = await activeProgram()
  if (!program) return []

  const partners = await prisma.giftProgramPartner.findMany({
    where: { programId: program.id, organisationId: { in: ids } },
    orderBy: { organisation: { name: 'asc' } },
    select: {
      allocation: true,
      organisation: { select: { id: true, name: true, logoUrl: true } },
    },
  })

  const children = await prisma.giftChild.findMany({
    where: { programId: program.id, organisationId: { in: ids } },
    select: {
      organisationId: true,
      wishWant: true,
      wishNeed: true,
      wishWear: true,
      wishRead: true,
    },
  })

  return partners.map((p) => {
    const mine = children.filter((c) => c.organisationId === p.organisation.id)
    return {
      id: p.organisation.id,
      name: p.organisation.name,
      logoUrl: p.organisation.logoUrl,
      allocation: p.allocation,
      nominated: mine.length,
      unfilled: mine.filter((c) => !wishListReady(c)).length,
    }
  })
}

/* ── The admin lists ───────────────────────────────────────────────────────
 *
 * One query each, serving both audiences. `scopeToOrgs` decides what somebody
 * is allowed to see; the filters decide what they asked to see. Keeping those
 * two separate is what stops a filter widening an organisation's view.
 */

/**
 * Which organisations this viewer may read across.
 *
 * Null means "every enrolled organisation" — Lighthouse. An array means those
 * and no others. An empty array means nothing, which is the safe answer for
 * somebody who administers no enrolled organisation.
 */
export async function slhScope(): Promise<string[] | null> {
  const session = await getSession()
  if (!session) return []
  if (canPreviewSlh(session.user)) return null
  return myProgramOrgIds()
}

export type ShopperRow = {
  id: string
  name: string | null
  email: string
  organisationId: string
  organisation: string
  requested: number
  held: number
  delivered: number
  steps: { done: number; total: number }
  joinedAt: Date
  preferredAge: string
  preferredGender: string
}

export async function shopperRows(filters: {
  organisationId?: string
  status?: string
}): Promise<ShopperRow[]> {
  const scope = await slhScope()
  if (scope?.length === 0) return []

  const program = await activeProgram()
  if (!program) return []

  // A filter narrows what you may already see; it never widens it.
  const orgWhere =
    filters.organisationId && (scope === null || scope.includes(filters.organisationId))
      ? { organisationId: filters.organisationId }
      : scope === null
        ? {}
        : { organisationId: { in: scope } }

  const shoppers = await prisma.giftShopper.findMany({
    where: { programId: program.id, ...orgWhere },
    orderBy: { createdAt: 'desc' },
    include: {
      organisation: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
      children: {
        select: {
          receivedAt: true,
          shoppedAt: true,
          wrappedAt: true,
          labelsAt: true,
          dropoffAt: true,
          deliveredAt: true,
        },
      },
    },
  })

  return shoppers.map((s) => ({
    id: s.id,
    name: s.user.name,
    email: s.user.email,
    organisationId: s.organisation.id,
    organisation: s.organisation.name,
    requested: s.requested,
    held: s.children.length,
    delivered: s.children.filter((c) => c.deliveredAt).length,
    steps: {
      done: s.children.reduce((n, c) => n + doneCount(c), 0),
      total: s.children.length * WISH_STEPS.length,
    },
    joinedAt: s.createdAt,
    preferredAge: s.preferredAge,
    preferredGender: s.preferredGender,
  }))
}

export type WishListRow = {
  id: string
  firstName: string
  age: number
  gender: string
  organisationId: string
  organisation: string
  filled: boolean
  shopperId: string | null
  shopperName: string | null
  deliveredAt: Date | null
  steps: { done: number; total: number }
  guardian: string | null
}

export async function wishListRows(filters: {
  organisationId?: string
  gender?: string
  age?: string
  search?: string
}): Promise<WishListRow[]> {
  const scope = await slhScope()
  if (scope?.length === 0) return []

  const program = await activeProgram()
  if (!program) return []

  const orgWhere =
    filters.organisationId && (scope === null || scope.includes(filters.organisationId))
      ? { organisationId: filters.organisationId }
      : scope === null
        ? {}
        : { organisationId: { in: scope } }

  // Ages are filtered as a birthday range rather than computed per row — see
  // `birthdayWindow`. Comparing stored dates beats loading everybody.
  const window = filters.age ? birthdayWindow(filters.age) : null

  const children = await prisma.giftChild.findMany({
    where: {
      programId: program.id,
      ...orgWhere,
      ...(filters.gender === 'girl' || filters.gender === 'boy'
        ? { gender: filters.gender }
        : {}),
      ...(window ? { dateOfBirth: { gt: window.gt, lte: window.lte } } : {}),
      ...(filters.search?.trim()
        ? { firstName: { contains: filters.search.trim(), mode: 'insensitive' as const } }
        : {}),
    },
    orderBy: [{ organisation: { name: 'asc' } }, { firstName: 'asc' }],
    include: {
      organisation: { select: { id: true, name: true } },
      family: { select: { guardianName: true } },
      shopper: { select: { id: true, user: { select: { name: true, email: true } } } },
    },
  })

  return children.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    age: ageOn(c.dateOfBirth),
    gender: c.gender,
    organisationId: c.organisation.id,
    organisation: c.organisation.name,
    filled: wishListReady(c),
    shopperId: c.shopper?.id ?? null,
    shopperName: c.shopper ? (c.shopper.user.name ?? c.shopper.user.email) : null,
    deliveredAt: c.deliveredAt,
    steps: { done: doneCount(c), total: WISH_STEPS.length },
    guardian: c.family?.guardianName ?? null,
  }))
}

/** The organisations a viewer may filter by, for the menus on both lists. */
export async function slhScopeOrgs(): Promise<{ id: string; name: string }[]> {
  const scope = await slhScope()
  if (scope?.length === 0) return []

  const program = await activeProgram()
  if (!program) return []

  const partners = await prisma.giftProgramPartner.findMany({
    where: {
      programId: program.id,
      ...(scope === null ? {} : { organisationId: { in: scope } }),
    },
    orderBy: { organisation: { name: 'asc' } },
    select: { organisation: { select: { id: true, name: true } } },
  })
  return partners.map((p) => p.organisation)
}

/** One shopper, everything about them. Null when not allowed or not there. */
export async function shopperDetail(id: string) {
  const scope = await slhScope()
  if (scope?.length === 0) return null

  const program = await activeProgram()
  if (!program) return null

  return prisma.giftShopper.findFirst({
    where: {
      id,
      programId: program.id,
      ...(scope === null ? {} : { organisationId: { in: scope } }),
    },
    include: {
      user: { select: { id: true, name: true, email: true, imageUrl: true } },
      organisation: { select: { id: true, name: true } },
      children: { orderBy: { firstName: 'asc' } },
    },
  })
}

/** Shoppers a list could be handed to, for the picker on the wish lists page. */
export async function assignableShoppers(): Promise<
  { id: string; name: string; organisationId: string; shortfall: number }[]
> {
  const rows = await shopperRows({})
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? r.email,
    organisationId: r.organisationId,
    shortfall: Math.max(0, r.requested - r.held),
  }))
}
