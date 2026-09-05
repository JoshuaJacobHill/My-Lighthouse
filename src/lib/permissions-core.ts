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
    'business.reports',
  ],
  // Staff, volunteers and trainees; project tasks; Care good news. No giving
  // data of any kind, and no church contact details.
  CARE_MANAGER: ['care.people', 'care.tasks', 'care.stories', 'business.reports'],
  // The church side: member contact details, tithe transactions, church stories
  // and serving teams. No volunteer or staff management, no Care donor data.
  CHURCH_MANAGER: [
    'church.members',
    'church.giving',
    'church.stories',
    'church.teams',
    'business.reports',
  ],
}

export interface PermissionUser {
  role: string | null
  canViewDonations: boolean
  canViewBusinessReports: boolean
}

/** Does this user hold this capability? SUPER_ADMIN always does. */
export function can(user: PermissionUser, capability: Capability): boolean {
  if (user.role === 'SUPER_ADMIN') return true
  const held = ROLE_CAPABILITIES[user.role ?? ''] ?? []
  if (!held.includes(capability)) return false
  if (user.role === 'ADMIN' && ADMIN_OPT_IN.includes(capability) && user.canViewDonations !== true) return false
  // Store revenue and ad spend are switched on per person, whatever the role.
  // Listing it against the admin roles above only makes them eligible; this is
  // what actually grants it, so adding someone is a tick rather than a deploy.
  if (capability === 'business.reports' && user.canViewBusinessReports !== true) return false
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

