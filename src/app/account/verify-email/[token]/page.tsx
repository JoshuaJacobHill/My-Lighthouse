import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { absorbGivingForEmail } from '@/lib/user-emails'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confirm your email' }

/**
 * Confirming an extra address.
 *
 * Two things are required, not one: the link out of that inbox, and a signed-in
 * session for the account it belongs to. The link alone proves someone can read
 * the mailbox; requiring the session as well means a forwarded or intercepted
 * link can't attach an address — and someone else's giving history — to an
 * account the holder doesn't control.
 */
export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(`/account/verify-email/${token}`)}`)

  const row = await prisma.userEmail.findUnique({
    where: { token },
    select: { id: true, userId: true, email: true, verifiedAt: true, tokenExpiresAt: true },
  })

  let state: 'done' | 'already' | 'expired' | 'wrong-account' | 'unknown' = 'unknown'
  let moved = 0

  if (!row) {
    state = 'unknown'
  } else if (row.verifiedAt) {
    state = 'already'
  } else if (row.userId !== session.userId) {
    // Signed in as somebody else — never silently attach it to whoever is here.
    state = 'wrong-account'
  } else if (row.tokenExpiresAt && row.tokenExpiresAt < new Date()) {
    state = 'expired'
  } else {
    await prisma.userEmail.update({
      where: { id: row.id },
      data: { verifiedAt: new Date(), token: null, tokenExpiresAt: null },
    })
    moved = await absorbGivingForEmail(row.userId, row.email)
    state = 'done'
  }

  const copy: Record<typeof state, { title: string; body: string }> = {
    done: {
      title: 'That’s linked',
      body:
        moved > 0
          ? `${row!.email} is now on your account, and we’ve brought ${moved} ${moved === 1 ? 'gift' : 'gifts'} across into your giving history.`
          : `${row!.email} is now on your account. Anything you give with it from here will show up alongside the rest.`,
    },
    already: { title: 'Already confirmed', body: 'That address is already on your account — nothing more to do.' },
    expired: {
      title: 'That link has expired',
      body: 'Confirmation links last 24 hours. Head to your account and send a fresh one.',
    },
    'wrong-account': {
      title: 'Wrong account',
      body: 'That link belongs to a different account. Sign out, sign back in as the right one, and try again.',
    },
    unknown: {
      title: 'We don’t recognise that link',
      body: 'It may have already been used, or been replaced by a newer one. Try sending a fresh link from your account.',
    },
  }

  const ok = state === 'done' || state === 'already'
  const { title, body } = copy[state]

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 py-16">
      <div className="w-full max-w-md rounded-[28px] border border-neutral-200 bg-white p-8 text-center">
        <span
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
        >
          {ok ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
        </span>
        <h1 className="mt-4 text-xl font-bold text-neutral-950">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{body}</p>
        <Link
          href="/dashboard/account"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600"
        >
          Back to my account
        </Link>
      </div>
    </div>
  )
}
