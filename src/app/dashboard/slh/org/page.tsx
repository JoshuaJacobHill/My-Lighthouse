import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Moved to `/admin/slh/organisations`.
 *
 * Approving a referrer, setting an allocation and setting a drop-off window
 * are administration, and they now sit together in the admin area with the
 * program's own settings. This redirect stays because the old address is in
 * people's history and in earlier conversations — a link that used to work
 * should not start returning a 404.
 */
export default async function SlhOrgPickerPage() {
  redirect('/admin/slh/organisations')
}
