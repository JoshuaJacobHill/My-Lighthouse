/**
 * Sending notifications.
 *
 * One entry point — `notify()` — used by server actions and crons alike. If
 * features each rolled their own fan-out, preferences and delivery would drift
 * apart within a month, so everything goes through here.
 *
 * A notification is a pointer. It carries a title, a line of text and an href,
 * and nothing else: the task lives in StaffTask, the story in Story, the shift
 * in ShiftAssignment. The destination page renders current state, so a
 * notification cannot go stale, and clearing one cannot destroy work.
 */

import { prisma } from '@/lib/prisma'
import type { Prisma, NotificationCategory } from '@prisma/client'
import type { Capability } from '@/lib/permissions-core'

/**
 * Who a notification goes to, as a rule rather than a list of ids. Stored on
 * the notification for the audit trail; resolved to real people at send time.
 */
export type Audience =
  | { kind: 'everyone' }
  | { kind: 'users'; ids: string[] }
  | { kind: 'staff' }
  | { kind: 'trainees' }
  | { kind: 'staffAndTrainees' }
  | { kind: 'church' }
  | { kind: 'volunteers'; status?: string }
  | { kind: 'donors' }
  | { kind: 'team'; teamId: string }
  | { kind: 'roles'; roles: string[] }

/** Human label for an audience, for the admin UI and the audit trail. */
export function describeAudience(a: Audience): string {
  switch (a.kind) {
    case 'everyone':
      return 'Everyone'
    case 'users':
      return a.ids.length === 1 ? '1 person' : `${a.ids.length} people`
    case 'staff':
      return 'Staff'
    case 'trainees':
      return 'Trainees'
    case 'staffAndTrainees':
      return 'Staff and trainees'
    case 'church':
      return 'Church members'
    case 'volunteers':
      return a.status ? `Volunteers (${a.status.toLowerCase()})` : 'Volunteers'
    case 'donors':
      return 'Supporters who have given'
    case 'team':
      return 'A serving team'
    case 'roles':
      return `Roles: ${a.roles.join(', ')}`
  }
}

/**
 * The capability someone needs to send to an audience. Reuses the existing
 * permission map rather than inventing a second idea of who may do what.
 * `null` means any admin may send to it.
 */
export function audienceCapability(a: Audience): Capability | null {
  switch (a.kind) {
    case 'church':
      return 'church.members'
    case 'team':
      return 'church.teams'
    case 'volunteers':
      return 'care.people'
    case 'donors':
      return 'care.giving'
    case 'roles':
      return 'system.users'
    default:
      return null
  }
}

/** Turn an audience rule into a `where` for User. Inactive people never match. */
function audienceWhere(a: Audience): Prisma.UserWhereInput {
  const active: Prisma.UserWhereInput = { isActive: true }
  switch (a.kind) {
    case 'everyone':
      return active
    case 'users':
      return { ...active, id: { in: a.ids } }
    case 'staff':
      return { ...active, isStaff: true }
    case 'trainees':
      return { ...active, isTrainee: true }
    case 'staffAndTrainees':
      return { ...active, OR: [{ isStaff: true }, { isTrainee: true }] }
    case 'church':
      return { ...active, isChurchMember: true }
    case 'volunteers':
      return {
        ...active,
        volunteerProfile: a.status ? { status: a.status as never } : { isNot: null },
      }
    case 'donors':
      return { ...active, donations: { some: {} } }
    case 'team':
      return { ...active, teamInterests: { some: { teamId: a.teamId } } }
    case 'roles':
      return { ...active, role: { in: a.roles as never[] } }
  }
}

/** Everyone an audience resolves to, right now. */
export async function resolveAudience(a: Audience): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: audienceWhere(a),
    select: { id: true },
  })
  return users.map((u) => u.id)
}

const DEFAULT_ACTION: Record<NotificationCategory, string> = {
  STORY: 'Read now',
  TASK: 'View now',
  SHIFT: 'View shift',
  CHALLENGE: 'View challenge',
  GIVING: 'View now',
  ADMIN: 'View now',
  GENERAL: 'View now',
}

export type NotifyInput = {
  audience: Audience
  category: NotificationCategory
  /** The thing itself, shown in bold: "Pack shelves", "Cindy's Story". */
  title: string
  /** One line about what happened. */
  body: string
  /** Where tapping it goes. */
  href: string
  actionLabel?: string
  /** Who sent it, when a person did. Crons leave this unset. */
  createdById?: string
  /**
   * Someone to leave out — almost always the person who caused the event, who
   * does not need telling about their own action.
   */
  exceptUserId?: string
}

/**
 * Send a notification. Returns how many people received it.
 *
 * Never throws into the caller's path: a notification failing must not fail the
 * action that triggered it. A story still publishes if telling people breaks.
 */
export async function notify(input: NotifyInput): Promise<number> {
  try {
    let userIds = await resolveAudience(input.audience)
    if (input.exceptUserId) userIds = userIds.filter((id) => id !== input.exceptUserId)
    if (userIds.length === 0) return 0

    await prisma.notification.create({
      data: {
        category: input.category,
        title: input.title,
        body: input.body,
        href: input.href,
        actionLabel: input.actionLabel ?? DEFAULT_ACTION[input.category],
        audience: input.audience as unknown as Prisma.InputJsonValue,
        createdById: input.createdById,
        recipients: {
          createMany: { data: userIds.map((userId) => ({ userId })) },
        },
      },
      select: { id: true },
    })

    return userIds.length
  } catch (err) {
    console.error('notify failed', err)
    return 0
  }
}
