import { redirect } from 'next/navigation'

// The volunteer dashboard has been folded into the one unified portal dashboard.
export default function VolunteerIndex() {
  redirect('/donor')
}
