import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { PushToggle } from '@/components/notifications/PushToggle'
import { NotifyToggles } from './NotifyToggles'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications' }

export default async function NotificationSettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const prefs = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: {
      notifyEmail: true,
      notifyComments: true,
      notifyMentions: true,
      notifyStories: true,
    },
  })

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/account"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Account
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Notifications</h1>
        <p className="mt-2 text-neutral-500">
          Choose what reaches you. Tasks and shift requests always come through — they&apos;re
          things people are waiting on.
        </p>

        <div className="mt-7">
          <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        </div>

        <h2 className="mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">
          What to tell me about
        </h2>
        <div className="mt-1">
          <NotifyToggles prefs={prefs} />
        </div>
      </div>
    </div>
  )
}
