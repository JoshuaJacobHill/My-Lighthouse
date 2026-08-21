import SignupClient, { type SignupPrefill } from './SignupClient'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  // If a signed-in donor is signing up to volunteer, prefill what we already know.
  const session = await getSession()
  let prefill: SignupPrefill | undefined

  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        donorProfile: { select: { phone: true, address: true } },
      },
    })
    if (user) {
      const parts = (user.name ?? '').trim().split(/\s+/).filter(Boolean)
      prefill = {
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' '),
        email: user.email,
        mobile: user.donorProfile?.phone ?? '',
        addressLine1: user.donorProfile?.address ?? '',
      }
    }
  }

  return <SignupClient prefill={prefill} isLoggedIn={Boolean(session)} />
}
