import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { GiveAgainFlow } from './GiveAgainFlow'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Give — Lighthouse Care' }

// Fast "give again" flow for logged-in donors. Deliberately minimal (amount →
// pay), distinct from the full /donate form. Anonymous visitors go to /donate.
// Optional ?fund=<slug> targets a specific fund/appeal; defaults to Lighthouse Care.
export default async function GiveAgainPage({
  searchParams,
}: {
  searchParams: Promise<{ fund?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/donate')

  const { fund: fundParam } = await searchParams

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  })
  if (!user) redirect('/donate')

  // Resolve the requested fund; fall back to Lighthouse Care if missing/inactive.
  let fund = fundParam
    ? await prisma.fund.findFirst({ where: { slug: fundParam, isActive: true }, select: { slug: true, name: true } })
    : null
  if (!fund) {
    fund = await prisma.fund.findUnique({ where: { slug: 'lighthouse-care' }, select: { slug: true, name: true } })
  }

  return (
    <GiveAgainFlow
      userName={user.name ?? 'friend'}
      fundName={fund?.name ?? 'Lighthouse Care'}
      fundSlug={fund?.slug ?? 'lighthouse-care'}
    />
  )
}
