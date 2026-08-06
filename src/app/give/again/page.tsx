import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { resolveAccount } from '@/lib/stripe-accounts'
import { GiveAgainFlow } from './GiveAgainFlow'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Give — Lighthouse Care' }

// Fast "give again" flow for logged-in donors. Deliberately minimal (amount →
// pay), distinct from the full /donate form. Anonymous visitors go to /donate.
export default async function GiveAgainPage() {
  const session = await getSession()
  if (!session) redirect('/donate')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  })
  if (!user) redirect('/donate')

  const fund = await prisma.fund.findUnique({
    where: { slug: 'lighthouse-care' },
    select: { slug: true, name: true, isActive: true, depositAccount: true },
  })

  return (
    <GiveAgainFlow
      userName={user.name ?? 'friend'}
      email={user.email}
      fundSlug={fund?.isActive ? fund.slug : 'lighthouse-care'}
      fundName={fund?.name ?? 'Lighthouse Care'}
      accountKey={resolveAccount(fund?.depositAccount)}
    />
  )
}
