'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * The bell, with a dot when something is unread.
 *
 * A count rather than a bare dot up to nine, because "3 things waiting" and
 * "one thing waiting" prompt different behaviour. Past nine the exact number
 * stops mattering and 9+ reads more calmly than a crowded two digits.
 */
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname()
  const active = pathname === '/dashboard/notifications'
  const has = unreadCount > 0

  return (
    <Link
      href="/dashboard/notifications"
      // Always a fresh count: a prefetched badge is a wrong badge.
      prefetch={false}
      aria-label={
        has
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
      className={clsx(
        'relative rounded-md p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500',
        active ? 'text-orange-600' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800',
      )}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {has && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
