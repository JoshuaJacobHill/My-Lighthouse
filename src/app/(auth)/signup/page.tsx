import { Suspense } from 'react'
import { SignupForm } from './SignupForm'

export const metadata = {
  title: 'Sign up',
  description:
    'Create your My Lighthouse Portal account — see your giving, manage regular gifts, find volunteering and hear about events first.',
}

/**
 * The form reads `?next=` so a campaign link survives creating an account,
 * and `useSearchParams` needs a Suspense boundary or this page cannot be
 * prerendered at all. Same arrangement as the sign-in page next door.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
