import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAdminRole } from '@/lib/permissions-core'
import { ConnectHealth } from './ConnectHealth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Connect Apple Health' }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'

export default async function ConnectFitnessPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isStaff: true, isTrainee: true, role: true },
  })
  if (!me || !(me.isStaff || me.isTrainee || isAdminRole(me.role))) notFound()

  const [link, shortcutSetting] = await Promise.all([
    prisma.fitnessLink.findFirst({
      where: { userId: me.id, revokedAt: null },
      select: { token: true, createdAt: true, lastUsedAt: true, lastAmount: true },
    }),
    prisma.appSetting.findUnique({ where: { key: 'fitness_shortcut_url' }, select: { value: true } }),
  ])
  const shortcutUrl = shortcutSetting?.value?.trim() || null

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <Link
          href="/dashboard/fitness"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the challenge
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Send your steps automatically</h1>
        <p className="mt-2.5 text-neutral-500">
          Your phone already counts your steps. This lets it send the daily total across on its own. Completely
          optional.
        </p>

        <ConnectHealth
          initialToken={link?.token ?? null}
          appUrl={APP_URL}
          shortcutUrl={shortcutUrl}
          lastUsedAt={link?.lastUsedAt ? link.lastUsedAt.toISOString() : null}
          lastAmount={link?.lastAmount ?? null}
        />
      </div>
    </div>
  )
}
