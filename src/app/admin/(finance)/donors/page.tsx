import { redirect } from 'next/navigation'

// Donors have been folded into the unified Users tab. Keep this route as a
// redirect so old links/bookmarks still land somewhere sensible.
export default function DonorsRedirect() {
  redirect('/admin/users?type=donors')
}
