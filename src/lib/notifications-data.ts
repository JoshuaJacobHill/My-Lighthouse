/**
 * Reading your own notifications.
 *
 * Two queries matter and both are indexed for: the feed (mine, not cleared,
 * newest first) and the badge (mine, unread, not cleared). Wrapped in React's
 * `cache` so the header bell and the feed page share one round trip.
 */

import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import type { NotificationCategory } from '@prisma/client'

/** Anything older than this drops out of the feed on its own. */
export const FEED_DAYS = 30

export type FeedItem = {
  /** The recipient row id — what read and clear act on. */
  id: string
  category: NotificationCategory
  title: string
  body: string
  href: string
  actionLabel: string
  createdAt: Date
  read: boolean
}

function cutoff(): Date {
  return new Date(Date.now() - FEED_DAYS * 24 * 60 * 60 * 1000)
}

/** Someone's feed: not cleared, not aged out, newest first. */
export const getMyNotifications = cache(async function getMyNotifications(
  userId: string,
  take = 40,
): Promise<FeedItem[]> {
  const rows = await prisma.notificationRecipient.findMany({
    where: { userId, dismissedAt: null, createdAt: { gte: cutoff() } },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      readAt: true,
      createdAt: true,
      notification: {
        select: {
          category: true,
          title: true,
          body: true,
          href: true,
          actionLabel: true,
        },
      },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    category: r.notification.category,
    title: r.notification.title,
    body: r.notification.body,
    href: r.notification.href,
    actionLabel: r.notification.actionLabel ?? 'View now',
    createdAt: r.createdAt,
    read: r.readAt !== null,
  }))
})

/** The number on the bell. */
export const getUnreadCount = cache(async function getUnreadCount(
  userId: string,
): Promise<number> {
  return prisma.notificationRecipient.count({
    where: { userId, readAt: null, dismissedAt: null, createdAt: { gte: cutoff() } },
  })
})
