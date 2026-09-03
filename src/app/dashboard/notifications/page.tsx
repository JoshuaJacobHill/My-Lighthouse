import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getMyNotifications, FEED_DAYS } from '@/lib/notifications-data'
import { NotificationFeed } from './NotificationFeed'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const items = await getMyNotifications(session.userId)

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Notifications</h1>
        <p className="mt-2 text-neutral-500">
          Anything new for you — stories, tasks, shifts. Cleared automatically after {FEED_DAYS} days.
        </p>

        <div className="mt-6">
          <NotificationFeed items={items} />
        </div>
      </div>
    </div>
  )
}
