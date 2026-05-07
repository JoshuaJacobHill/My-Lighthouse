import SignupClient from './SignupClient'
import type { TimePeriodItem } from './SignupClient'

export const dynamic = 'force-dynamic'

// Fixed availability periods shown on the signup form.
// These are deliberately hardcoded — independent of the admin's customisable
// Settings labels — so the signup form always shows clear, sensible options
// regardless of how the coordinator has named the internal shift slots.
const SIGNUP_AVAILABILITY_PERIODS: TimePeriodItem[] = [
  { key: 'MORNING',   label: 'Morning',   hours: '9 am – 12 pm' },
  { key: 'AFTERNOON', label: 'Afternoon', hours: '12 pm – 5 pm' },
]

// First-visit options are limited to within coordinator hours (9 am – 5 pm).
// Evening / Pre-Open slots are not available for first visits.
const FIRST_VISIT_PERIODS: TimePeriodItem[] = [
  { key: 'MORNING',   label: 'Morning',   hours: '9 am – 12 pm' },
  { key: 'AFTERNOON', label: 'Afternoon', hours: '12 pm – 5 pm' },
]

export default async function SignupPage() {
  return (
    <SignupClient
      timePeriods={SIGNUP_AVAILABILITY_PERIODS}
      firstVisitPeriods={FIRST_VISIT_PERIODS}
    />
  )
}
