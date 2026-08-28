import { requireCapability } from '@/lib/permissions'

/**
 * Email templates and bulk sends are app-wide configuration, so the whole
 * subtree sits behind `system.settings`. It lives in a layout rather than on
 * each page because /admin/emails/send is a Client Component and can't await a
 * guard of its own.
 */
export default async function EmailsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('system.settings')
  return <>{children}</>
}
