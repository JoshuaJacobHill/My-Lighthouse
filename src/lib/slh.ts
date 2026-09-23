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
