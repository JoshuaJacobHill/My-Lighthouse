import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import ProfileForm from './ProfileForm'
import { OptOutSection } from '@/components/volunteer/OptOutSection'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Profile',
}

export default async function ProfilePage() {
  const session = await getSession()
  if (!session?.volunteerId) redirect('/login')

  const volunteer = await prisma.volunteerProfile.findUnique({
    where: { id: session.volunteerId },
  })

  if (!volunteer) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Keep your personal details and preferences up to date so we can support you well.
        </p>
      </div>
      <ProfileForm volunteer={volunteer} />

      {/* Opt-out — shown below the main form */}
      <div className="mt-8">
        <OptOutSection />
      </div>
    </div>
  )
}
