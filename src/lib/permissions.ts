import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { can, isAdminRole, type Capability, type PermissionUser } from '@/lib/permissions-core'

/**
 * Server-side permission guards. The rules themselves live in
 * `permissions-core.ts` so client components can share them.
 */

export * from '@/lib/permissions-core'

// ─── Session-based helpers ────────────────────────────────────────────────────

/**
 * The signed-in user's role and donations flag, or null if not signed in.
 *
 * Memoised per request: the layout, the page guard and the nav all need this,
 * and each one was issuing its own query.
 */
export const getPermissionUser = cache(async function getPermissionUser(): Promise<PermissionUser | null> {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, canViewDonations: true },
  })
  return user ?? null
})

/** Every capability the signed-in user holds — for passing into client nav. */
export async function getCapabilities(): Promise<Capability[]> {
  const user = await getPermissionUser()
  if (!user) return []
  const all: Capability[] = [
    'care.people',
    'care.tasks',
    'care.stories',
    'care.giving',
    'church.members',
    'church.giving',
    'church.stories',
    'church.teams',
    'system.settings',
    'system.users',
  ]
  return all.filter((c) => can(user, c))
}

/** Boolean for nav/UI decisions (does the signed-in admin have donations access?). */
export async function getDonationsAccess(): Promise<boolean> {
  const user = await getPermissionUser()
  return !!user && can(user, 'care.giving')
}

/**
 * Page guard. Redirects to /admin when the signed-in admin lacks the capability,
 * and to /login when they aren't an admin at all.
 */
export async function requireCapability(capability: Capability): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) redirect('/login')
  const user = await getPermissionUser()
  if (!user || !isAdminRole(user.role)) redirect('/login')
  if (!can(user, capability)) redirect('/admin')
  return { userId: session.userId, role: session.role }
}

/** As above, but satisfied by any one of several capabilities. */
export async function requireAnyCapability(
  capabilities: Capability[]
): Promise<{ userId: string; role: string; held: Capability[] }> {
  const session = await getSession()
  if (!session) redirect('/login')
  const user = await getPermissionUser()
  if (!user || !isAdminRole(user.role)) redirect('/login')
  const held = capabilities.filter((c) => can(user, c))
  if (held.length === 0) redirect('/admin')
  return { userId: session.userId, role: session.role, held }
}

/** Page guard: any admin role. Use a capability guard where one fits. */
export async function requireAdmin(): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session || !isAdminRole(session.role)) redirect('/login')
  return { userId: session.userId, role: session.role }
}

/**
 * @deprecated Use `requireCapability('care.giving')`.
 */
export async function requireDonationsAccess(): Promise<{ userId: string; role: string }> {
  return requireCapability('care.giving')
}

/**
 * Guard for server actions. Throws rather than redirecting — actions are called
 * over RPC, so there's no navigation to hijack, and every caller in this app
 * already turns a thrown error into `{ success: false, error }`.
 *
 * Page guards alone are not enough: a server action is a callable endpoint, so
 * hiding a nav link or bouncing a page does nothing to stop a direct call.
 */
export async function assertCapability(capability: Capability): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  const user = await getPermissionUser()
  if (!user || !isAdminRole(user.role) || !can(user, capability)) {
    throw new Error('Insufficient permissions')
  }
  return { userId: session.userId, role: session.role }
}

/** As above, satisfied by any one of several capabilities. */
export async function assertAnyCapability(capabilities: Capability[]): Promise<{ userId: string; role: string }> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  const user = await getPermissionUser()
  if (!user || !isAdminRole(user.role) || !capabilities.some((c) => can(user, c))) {
    throw new Error('Insufficient permissions')
  }
  return { userId: session.userId, role: session.role }
}

/**
 * Boolean capability check for API route handlers, which return their own JSON
 * error bodies and status codes rather than throwing or redirecting.
 */
export async function hasCapability(capability: Capability): Promise<boolean> {
  const user = await getPermissionUser()
  return !!user && isAdminRole(user.role) && can(user, capability)
}
