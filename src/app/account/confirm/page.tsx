import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import prisma from '@/lib/prisma'
import { validateAccountSetupToken, consumeAccountSetupToken } from '@/lib/account-setup'
import { claimDonationsForUser } from '@/lib/donations'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confirm your email', robots: { index: false } }

/**
 * Email confirmation for a self-serve sign-up. Verifying the address is what
 * allows past (and future) giving to attach to the account, so it's done via a
 * single-use token sent to that inbox.
 */
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const valid = token ? await validateAccountSetupToken(token) : null

  let claimed = 0
  let ok = false

  if (valid) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: valid.email, mode: 'insensitive' } },
      select: { id: true, emailVerified: true },
    })
    if (user) {
      const now = user.emailVerified ?? new Date()
      if (!user.emailVerified) {
        await prisma.user.update({ where: { id: user.id }, data: { emailVerified: now } })
      }
      claimed = await claimDonationsForUser(user.id, valid.email, now)
      await consumeAccountSetupToken(token!)
      ok = true
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/logo-inline-black.png" alt="Lighthouse Care" width={180} height={48} className="h-9 w-auto" />
        </div>
        <div className="rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          {ok ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <h1 className="mt-4 text-2xl font-bold text-neutral-900">Email confirmed</h1>
              <p className="mt-2 text-sm text-neutral-600">
                Thank you — your email address is confirmed.
                {claimed > 0
                  ? ` We’ve added ${claimed} previous ${claimed === 1 ? 'gift' : 'gifts'} to your account.`
                  : ' Any giving under this address will now appear in your account.'}
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Go to my dashboard
              </Link>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
              <h1 className="mt-4 text-2xl font-bold text-neutral-900">This link isn&rsquo;t valid</h1>
              <p className="mt-2 text-sm text-neutral-600">
                It may have already been used or expired. You can request a new one from your account settings.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
