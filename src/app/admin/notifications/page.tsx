import { requireCapability } from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { resolveAudience } from '@/lib/notifications'
import { ComposeNotification } from './ComposeNotification'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications | Lighthouse Care Admin' }

export default async function AdminNotificationsPage() {
  await requireCapability('system.settings')

  const [teams, recent] = await Promise.all([
    prisma.servingTeam.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // The last few, with how many people each reached and how many have looked.
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        _count: { select: { recipients: true } },
      },
    }),
  ])

  // The default audience in the form, counted here so the client renders it
  // straight away instead of fetching on mount.
  const defaultAudience = await resolveAudience({ kind: 'staffAndTrainees' })

  const readCounts = await prisma.notificationRecipient.groupBy({
    by: ['notificationId'],
    where: { notificationId: { in: recent.map((r) => r.id) }, readAt: { not: null } },
    _count: { _all: true },
  })
  const readBy = new Map(readCounts.map((r) => [r.notificationId, r._count._all]))

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950">Notifications</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A short line that appears in someone&apos;s notifications, with a link to the thing itself.
        </p>
      </div>

      <ComposeNotification teams={teams} initialCount={defaultAudience.length} />

      <div>
        <h2 className="text-lg font-bold text-neutral-950">Recently sent</h2>
        {recent.length === 0 ? (
          <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
            Nothing sent yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
            {recent.map((n) => (
              <li key={n.id} className="p-4">
                <p className="text-[15px] leading-snug text-neutral-950">
                  <span className="font-bold">{n.title}</span>{' '}
                  <span className="text-neutral-600">{n.body}</span>
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {n._count.recipients} {n._count.recipients === 1 ? 'person' : 'people'} ·{' '}
                  {readBy.get(n.id) ?? 0} opened ·{' '}
                  {new Intl.DateTimeFormat('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Australia/Brisbane',
                  }).format(n.createdAt)}
                  {n.createdBy?.name ? ` · ${n.createdBy.name}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
