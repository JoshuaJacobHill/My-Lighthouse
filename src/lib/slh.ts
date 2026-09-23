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
 * corporate partner has no drop-off window — so it lands on a join table when
 * the schema exists. Until then `slh-sample.ts` stands in for it, and the
 * organisation itself is real.
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
  /** Whether this person administers it, rather than just being able to see it. */
  mine: boolean
}

/**
 * Organisations this person can open the program area for.
 *
 * Normally the ones they administer — the same per-row rule the partner pages
 * use, because a global "partner admin" would hand its holder every company at
 * once. A super admin previewing sees every organisation, which is the only
 * reason this is not simply `myMemberships()`.
 */
export async function slhOrgsForViewer(): Promise<SlhOrgSummary[]> {
  const session = await getSession()
  if (!session) return []

  const mine = await prisma.orgMember.findMany({
    where: { userId: session.userId, status: 'ACTIVE', role: 'ADMIN' },
    select: { organisationId: true },
  })
  const mineIds = new Set(mine.map((m) => m.organisationId))

  const orgs = await prisma.organisation.findMany({
    where: canPreviewSlh(session.user) ? {} : { id: { in: [...mineIds] } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      _count: { select: { members: true } },
    },
  })

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    logoUrl: o.logoUrl,
    members: o._count.members,
    mine: mineIds.has(o.id),
  }))
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
