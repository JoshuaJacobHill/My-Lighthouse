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

/**
 * Take ticket payment on our own page instead of Stripe's hosted Checkout.
 *
 * Off by default on purpose. Hosted Checkout works and takes real money, so the
 * replacement stays behind a switch until somebody has bought a ticket through
 * it with a real card. Both paths are live at once: the webhook handles the
 * hosted `checkout.session.completed` and the on-page `payment_intent.succeeded`
 * either way, so flipping this back is instant and loses nothing in flight.
 */
export function isOnPageTicketCheckoutEnabled(): boolean {
  return process.env.TICKETS_ON_PAGE_CHECKOUT === 'true'
}

/**
 * Who can see the Santa's Little Helpers preview.
 *
 * A role rather than a capability, deliberately, and this is the exception that
 * proves the rule in `AGENTS.md`. A capability answers "may this person do this
 * job"; this answers "is this finished enough to show anybody", which is a
 * different question with a different lifespan. It disappears the moment the
 * program has real data and a real audience.
 *
 * Until then the pages render sample data, so nobody but a super admin should
 * find them — not because the content is sensitive, but because it is fiction.
 */
export function canPreviewSlh(user: { role?: string | null }): boolean {
  return user.role === 'SUPER_ADMIN'
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
