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
  if (!(me?.isStaff || me?.isTrainee || isAdminRole(me?.role))) notFound()

  const link = await prisma.fitnessLink.findFirst({
    where: { userId: me!.id, revokedAt: null },
    select: { token: true, createdAt: true, lastUsedAt: true, lastAmount: true },
  })

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
        <p className="mt-3 text-neutral-600">
          Your phone already counts your steps. This lets it send that number across each night, so you don&rsquo;t
          have to remember to type it in. It&rsquo;s completely optional &mdash; typing your steps in by hand works
          just as well.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">What we can and can&rsquo;t see</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li>
              <strong>We only ever receive a step count and a date.</strong> Nothing else from Health &mdash; no heart
              rate, no workouts, no location, no sleep.
            </li>
            <li>
              <strong>Your phone does the sending.</strong> We have no way to reach into your Health app, and this
              can&rsquo;t pull anything on its own.
            </li>
            <li>
              <strong>You can stop it any time</strong> with the button at the bottom of this page, or by deleting the
              shortcut from your phone.
            </li>
          </ul>
        </div>

        <ConnectHealth
          initialToken={link?.token ?? null}
          endpoint={`${APP_URL}/api/fitness/steps`}
          lastUsedAt={link?.lastUsedAt ? link.lastUsedAt.toISOString() : null}
          lastAmount={link?.lastAmount ?? null}
        />
      </div>
    </div>
  )
}
