import { isAdminRole } from '@/lib/permissions-core'
/**
 * Feature flags for the platform.
 *
 * The Donor & Fundraising Portal is built behind a flag so it stays completely
 * hidden from volunteers and the public until launch. See docs/donor-portal-plan.md.
 *
 * While the flag is OFF, the donor portal is reachable only by:
 *   - accounts on the early-access allow-list (DONOR_PORTAL_EARLY_ACCESS_EMAILS), and
 *   - admins (ADMIN / SUPER_ADMIN), so staff can preview during the build.
 *
 * At launch, set DONOR_PORTAL_ENABLED=true and the portal opens to all logged-in
 * users. (Later this toggle can move to the AppSetting table for no-redeploy flips.)
 */

export function isDonorPortalEnabled(): boolean {
  return process.env.DONOR_PORTAL_ENABLED === 'true'
}

function earlyAccessEmails(): string[] {
  return (process.env.DONOR_PORTAL_EARLY_ACCESS_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isEarlyAccessEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return earlyAccessEmails().includes(email.toLowerCase())
}

/**
 * Whether the given user may reach the donor portal front end right now.
 * Once the flag is on, everyone logged in can; until then, only early-access
 * accounts and admins (for previewing the build).
 */
export function canAccessDonorPortal(user: {
  email?: string | null
  role?: string | null
}): boolean {
  if (isDonorPortalEnabled()) return true
  if (isEarlyAccessEmail(user.email)) return true
  if (user.role && isAdminRole(user.role)) return true
  return false
}
