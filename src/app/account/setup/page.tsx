import { notFound } from 'next/navigation'
import Image from 'next/image'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { validateAccountSetupToken } from '@/lib/account-setup'
import { SetupForm } from './SetupForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Set up your account — Lighthouse Care',
  robots: { index: false },
}

export default async function AccountSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  if (!isDonorPortalEnabled()) notFound()

  const { token } = await searchParams
  const valid = token ? await validateAccountSetupToken(token) : null

  // Pre-fill the name from their most recent gift, if we have it.
  let suggestedName = ''
  if (valid) {
    const gift = await prisma.donation.findFirst({
      where: { donorEmail: { equals: valid.email, mode: 'insensitive' }, donorName: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { donorName: true },
    })
    suggestedName = gift?.donorName ?? ''
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-500 to-orange-700 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <Image src="/logo-inline-black.png" alt="Lighthouse Care" width={180} height={48} className="h-9 w-auto brightness-0 invert" />
          <p className="mt-2 text-sm text-orange-50">Donor portal</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          {valid ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Set up your account</h1>
              <p className="mt-2 text-sm text-gray-500">
                Choose a password for <strong>{valid.email}</strong>. Your giving history and
                receipts will be ready and waiting.
              </p>
              <div className="mt-6">
                <SetupForm token={token!} suggestedName={suggestedName} />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Link expired</h1>
              <p className="mt-2 text-sm text-gray-500">
                This account setup link is invalid or has expired. Make another donation, or
                use “Forgot your password?” on the sign-in page if you already have an account.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
