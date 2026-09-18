import { redirect } from 'next/navigation'

/**
 * The marketing-only library is gone; there is one library now.
 *
 * Kept as a redirect rather than deleted, because the link to it went out in
 * the assistant panel and somebody will have it open.
 */
export default function MarketingLibraryRedirect() {
  redirect('/admin/media')
}
