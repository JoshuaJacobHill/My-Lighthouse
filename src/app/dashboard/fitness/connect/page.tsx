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

  // Came back with the session; this used to be a second serial query.
  const me = session.user
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

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Sending your steps</h1>
        <p className="mt-2.5 text-neutral-500">
          Your phone already counts your steps. Set it up once and you stop having to think about it. Different on
          iPhone and Android, so both are below.
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
