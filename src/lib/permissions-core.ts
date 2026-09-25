/**
 * Capability rules — deliberately free of prisma, next/navigation and every
 * other server-only import, so client components can ask the same questions the
 * server does without dragging the database driver into the browser bundle
 * (which Turbopack fails on, loudly, at build time).
 *
 * Server-side guards live in `permissions.ts`, which re-exports all of this.
 */

/**
 * Who can reach what in the admin area.
 *
 * The rule: call sites ask about a *capability*, never about a role. Roles get
 * added and re-scoped over time; if `role === 'ADMIN'` is written in seventy
 * places, every one of them is a place a new role silently gains or loses
 * access. Everything below funnels through `can()` and the map in
 * ROLE_CAPABILITIES, so adding a role is a one-line change here.
 *
 * The one deliberate exception is donor and church giving data, which is also
 * gated by the per-user `canViewDonations` flag on top of the role — see
 * `care.giving` / `church.giving` below.
 */

export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CARE_MANAGER', 'CHURCH_MANAGER'] as const

export type Capability =
  /** Volunteer, staff and trainee records; rosters, attendance, inductions, feedback. */
  | 'care.people'
  /** Staff tasks and the cleaning/maintenance checklists. */
  | 'care.tasks'
  /** Good news stories aimed at volunteers, staff and Care supporters. */
  | 'care.stories'
  /** Lighthouse Care giving — donors, funds, fundraisers, events, Care transactions. */
  | 'care.giving'
  /** Contact details of church members. */
  | 'church.members'
  /** Tithes and church giving transactions. */
  | 'church.giving'
  /** Good news stories aimed at the church. */
  | 'church.stories'
  /** Church serving teams. */
  | 'church.teams'
  /** App-wide settings and email templates. */
  | 'system.settings'
  /** Creating admins and assigning roles. */
  | 'system.users'
  /** Store sales, order volumes and marketing performance. */
  | 'business.reports'
  /**
   * Santa's Little Helpers: approving referring organisations, setting their
   * allocations, and reading every shopper and wish list across the program.
   *
   * A capability rather than a role check, now that the program holds real
   * children. Held only by SUPER_ADMIN for this year — the point of naming it
   * is that widening it later is a line in ROLE_CAPABILITIES rather than a
   * hunt through pages. It carries children's data and the reason a family was
   * nominated, so widen it deliberately.
   */
  | 'care.slh'
  /**
   * The households Lighthouse supports: who they are, what they have received,
   * case notes and referrals.
   *
   * The most sensitive capability in the app. It carries crisis circumstances,
   * children's names and dates of birth, and home addresses — for families who
   * came to us for food, not to be catalogued. Held only by SUPER_ADMIN until
   * somebody decides otherwise on purpose, and deliberately NOT bundled with
   * `care.people`: knowing the roster is not a reason to read a case note.
   */
  | 'care.families'

/**
 * Giving and donor-contact capabilities that a generic ADMIN only holds when
 * `canViewDonations` is ticked. That opt-in predates the scoped roles and is
 * kept exactly as it was, so nobody's access changes under them.
 *
 * It deliberately does NOT apply to CARE_MANAGER or CHURCH_MANAGER: seeing
 * tithes and church contact details *is* the church manager's job, and making
 * it depend on a second checkbox would mean every new church manager arrives
 * unable to do the thing they were created for.
 */
const ADMIN_OPT_IN: Capability[] = ['care.giving', 'church.members', 'church.giving']

const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  // Unchanged from before this file grew a capability map: a general admin does
  // everything except assign roles, and only sees giving with the flag set.
  ADMIN: [
    'care.people',
    'care.tasks',
    'care.stories',
    'care.giving',
    'church.members',
    'church.giving',
    'church.stories',
    'church.teams',
    'system.settings',
  ],
  // Staff, volunteers and trainees; project tasks; Care good news. No giving
  // data of any kind, and no church contact details.
  CARE_MANAGER: ['care.people', 'care.tasks', 'care.stories'],
  // The church side: member contact details, tithe transactions, church stories
  // and serving teams. No volunteer or staff management, no Care donor data.
  CHURCH_MANAGER: ['church.members', 'church.giving', 'church.stories', 'church.teams'],
}

export interface PermissionUser {
  role: string | null
  canViewDonations: boolean
  canViewBusinessReports: boolean
}

/** Does this user hold this capability? SUPER_ADMIN always does. */
export function can(user: PermissionUser, capability: Capability): boolean {
  if (user.role === 'SUPER_ADMIN') return true

  // The one capability granted by a switch rather than a role. Someone who
  // should see store revenue — a coordinator, a manager — does not thereby
  // need admin over volunteers, tasks or church records, and requiring a role
  // as well would have meant handing out far more access than was asked for.
  if (capability === 'business.reports') return user.canViewBusinessReports === true
  const held = ROLE_CAPABILITIES[user.role ?? ''] ?? []
  if (!held.includes(capability)) return false
  if (user.role === 'ADMIN' && ADMIN_OPT_IN.includes(capability) && user.canViewDonations !== true) return false
  return true
}

/** Any of these capabilities — for pages and nav items serving two audiences. */
export function canAny(user: PermissionUser, capabilities: Capability[]): boolean {
  return capabilities.some((c) => can(user, c))
}

/** Is this role an admin role at all (i.e. may it open /admin)? */
export function isAdminRole(role?: string | null): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role)
}

// ─── Backwards compatibility ──────────────────────────────────────────────────

/**
 * @deprecated Ask for a capability instead — `can(user, 'care.giving')`.
 * Kept because the finance route group and the admin nav were both written
 * around a single donations boolean.
 */
export function canSeeDonations(user: PermissionUser): boolean {
  return can(user, 'care.giving')
}

