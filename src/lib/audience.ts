/**
 * Server side of the audience rules: reading a viewer's connections, and
 * turning them into a filter the database can apply.
 *
 * The pure half — the rule itself, and whether one viewer may see one item —
 * is in `audience-core.ts`, which the admin picker imports. Keep the two in
 * step: `canSee` and `audienceWhere` express the same rule, one for a single
 * item and one for a list, and `audience.test.ts` checks them against each
 * other on every combination rather than trusting that they agree.
 */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { Audience } from '@/lib/notifications'
import {
  heldKinds,
  missingKinds,
  type AudienceKind,
  type AudienceRule,
  type ViewerConnections,
} from '@/lib/audience-core'

/** The fields a viewer's connections are derived from. */
export const VIEWER_CONNECTION_SELECT = {
  isChurchMember: true,
  isStaff: true,
  isTrainee: true,
  volunteerProfile: { select: { id: true } },
  orgMemberships: { where: { status: 'ACTIVE' as const }, select: { id: true }, take: 1 },
  _count: { select: { donations: true } },
} satisfies Prisma.UserSelect

/**
 * Loose on purpose: callers select these alongside whatever else the page
 * needs, and a volunteer profile selected for its status is still a volunteer
 * profile. Only presence matters here.
 */
type ViewerRow = {
  isChurchMember: boolean
  isStaff: boolean
  isTrainee: boolean
  volunteerProfile: object | null
  orgMemberships: unknown[]
  _count: { donations: number }
}

/**
 * Connections from a row already loaded for something else.
 *
 * Pages that need the viewer anyway should select `VIEWER_CONNECTION_SELECT`
 * and call this, rather than `loadViewerConnections` — every database
 * round-trip crosses Sydney→Tokyo, and a second one for facts already in hand
 * is a round-trip spent on nothing.
 */
export function connectionsFrom(row: ViewerRow): ViewerConnections {
  return {
    isChurchMember: row.isChurchMember,
    isStaff: row.isStaff,
    isTrainee: row.isTrainee,
    isVolunteer: row.volunteerProfile != null,
    hasGiven: row._count.donations > 0,
    isPartner: row.orgMemberships.length > 0,
  }
}

/** Connections for a user id, when nothing else needed the row. */
export async function loadViewerConnections(
  userId: string | null | undefined
): Promise<ViewerConnections | null> {
  if (!userId) return null
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: VIEWER_CONNECTION_SELECT,
  })
  return row ? connectionsFrom(row) : null
}

/**
 * The same rule as `canSee`, as a `where` fragment.
 *
 * Spread it into a query alongside `isPublished`. The audience columns are
 * identical on Story and Event, so the signed-in half is shared; the anonymous
 * half is not, because only an event can be public. A story has no
 * `audiencePublic` column at all — there is no public story page, and the
 * absence of the column is what keeps one from being added by accident.
 *
 * The ALL case is expressed backwards on purpose. "Holds every listed audience"
 * has no direct operator on a scalar list, but "holds none of the ones they are
 * missing" is the same statement, and `hasSome` can answer it.
 */
function kindsWhere(viewer: ViewerConnections) {
  const held = heldKinds(viewer)
  const missing = missingKinds(viewer)
  return {
    OR: [
      // No audiences listed — any signed-in supporter.
      { audienceKinds: { isEmpty: true } },
      { AND: [{ audienceMatch: 'ANY' as const }, { audienceKinds: { hasSome: held } }] },
      {
        AND: [
          { audienceMatch: 'ALL' as const },
          { NOT: { audienceKinds: { hasSome: missing } } },
        ],
      },
    ],
  }
}

/** Events, including the public ones a stranger may read. */
export function eventAudienceWhere(viewer: ViewerConnections | null): Prisma.EventWhereInput {
  return viewer ? kindsWhere(viewer) : { audiencePublic: true }
}

/**
 * Stories, which live behind a sign-in.
 *
 * Somebody not signed in matches nothing rather than matching the unrestricted
 * ones: `/dashboard/news` is the only reader, and a filter that quietly turned
 * permissive without a session is how the removed public story route leaked.
 */
export function storyAudienceWhere(viewer: ViewerConnections | null): Prisma.StoryWhereInput {
  return viewer ? kindsWhere(viewer) : { id: { in: [] } }
}

/**
 * The notification audience matching a content rule, so publishing to a set of
 * people notifies exactly those people.
 *
 * Extends the existing fan-out rather than adding a second one — the rule about
 * widening a narrower thing instead of building a parallel one applies to this
 * as much as to uploads.
 */
export function notificationAudienceFor(rule: AudienceRule): Audience {
  if (rule.kinds.length === 0) return { kind: 'everyone' }

  const one = (k: AudienceKind): Audience => {
    switch (k) {
      case 'church':
        return { kind: 'church' }
      case 'staff':
        return { kind: 'staffAndTrainees' }
      case 'volunteers':
        return { kind: 'volunteers' }
      case 'donors':
        return { kind: 'donors' }
      case 'partners':
        return { kind: 'partners' }
    }
  }

  if (rule.match === 'ALL') {
    // `flags` is the only shape that means "both at once", and it only knows
    // church and staff — which is every ALL rule that exists, because the
    // picker cannot produce one and the backfill only ever made church+staff.
    const church = rule.kinds.includes('church')
    const staff = rule.kinds.includes('staff')
    if (rule.kinds.every((k) => k === 'church' || k === 'staff')) {
      return { kind: 'flags', church: church || undefined, staff: staff || undefined }
    }
  }

  return rule.kinds.length === 1 ? one(rule.kinds[0]) : { kind: 'any', of: rule.kinds.map(one) }
}

/**
 * Connections from the flattened session user.
 *
 * `getSession` already carries every fact these rules need, so a page holding a
 * session needs no query at all — which is the difference between filtering
 * content for free and paying a Sydney→Tokyo round trip to do it.
 */
export function connectionsFromSession(u: {
  isChurchMember: boolean
  isStaff: boolean
  isTrainee: boolean
  hasVolunteerProfile: boolean
  donationCount: number
  isPartner: boolean
}): ViewerConnections {
  return {
    isChurchMember: u.isChurchMember,
    isStaff: u.isStaff,
    isTrainee: u.isTrainee,
    isVolunteer: u.hasVolunteerProfile,
    hasGiven: u.donationCount > 0,
    isPartner: u.isPartner,
  }
}
