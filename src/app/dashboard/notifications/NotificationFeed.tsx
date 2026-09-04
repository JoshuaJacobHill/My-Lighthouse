'use client'

import * as React from 'react'
import Link from 'next/link'
import { Bell, Newspaper, ClipboardCheck, CalendarClock, Footprints, HandHeart, Shield, X } from 'lucide-react'
import { clsx } from 'clsx'
import { markAllReadAction, clearAllAction, clearOneAction } from '@/lib/actions/notification.actions'
import type { FeedItem } from '@/lib/notifications-data'

const ICON = {
  STORY: Newspaper,
  TASK: ClipboardCheck,
  SHIFT: CalendarClock,
  CHALLENGE: Footprints,
  GIVING: HandHeart,
  ADMIN: Shield,
  GENERAL: Bell,
} as const

/** Muted, not shouty — the notification itself should carry the emphasis. */
const TINT = {
  STORY: 'bg-sky-50 text-sky-700',
  TASK: 'bg-orange-50 text-orange-700',
  SHIFT: 'bg-violet-50 text-violet-700',
  CHALLENGE: 'bg-lime-50 text-lime-700',
  GIVING: 'bg-rose-50 text-rose-700',
  ADMIN: 'bg-neutral-100 text-neutral-700',
  GENERAL: 'bg-neutral-100 text-neutral-700',
} as const

function ago(then: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(then).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(then))
}

export function NotificationFeed({ items }: { items: FeedItem[] }) {
  const [pending, startTransition] = React.useTransition()
  // Cleared optimistically: waiting on a round trip to make something vanish
  // feels broken, and the action revalidates anyway.
  const [cleared, setCleared] = React.useState<Set<string>>(new Set())
  const [clearedAll, setClearedAll] = React.useState(false)

  // Opening the panel clears the badge. The highlight on each unread item is
  // kept for this render, so you can still see what was new before it settles.
  React.useEffect(() => {
    if (items.some((i) => !i.read)) void markAllReadAction()
    // Once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = clearedAll ? [] : items.filter((i) => !cleared.has(i.id))

  function clearOne(id: string) {
    setCleared((prev) => new Set(prev).add(id))
    startTransition(async () => {
      await clearOneAction(id)
    })
  }

  function clearEverything() {
    setClearedAll(true)
    startTransition(async () => {
      await clearAllAction()
    })
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-neutral-300 px-6 py-14 text-center">
        <Bell className="mx-auto h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="mt-3 font-bold text-neutral-900">No new notifications</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {visible.length} {visible.length === 1 ? 'notification' : 'notifications'}
        </p>
        <button
          type="button"
          onClick={clearEverything}
          disabled={pending}
          className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
        >
          Clear all
        </button>
      </div>

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
        {visible.map((n) => {
          const Icon = ICON[n.category] ?? Bell
          return (
            <li
              key={n.id}
              className={clsx('relative', !n.read && 'bg-orange-50/40')}
            >
              <Link
                href={n.href}
                prefetch={false}
                className="flex items-start gap-4 py-4 pl-4 pr-11 transition-colors hover:bg-neutral-50"
              >
                <span
                  className={clsx(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    TINT[n.category] ?? TINT.GENERAL,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-snug text-neutral-950">
                    <span className="font-bold">{n.title}</span>{' '}
                    <span className="text-neutral-600">{n.body}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs">
                    <span className="font-semibold text-orange-600">{n.actionLabel}</span>
                    <span className="text-neutral-300">·</span>
                    <span className="text-neutral-500">{ago(n.createdAt)}</span>
                  </span>
                </span>

                {!n.read && (
                  <span
                    aria-hidden="true"
                    className="absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-500"
                  />
                )}
              </Link>

              {n.read && (
                <button
                  type="button"
                  onClick={() => clearOne(n.id)}
                  aria-label="Clear this notification"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
