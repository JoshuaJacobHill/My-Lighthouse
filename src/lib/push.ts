/**
 * Web push delivery.
 *
 * Sits behind `notify()` so nothing else has to know about it: every
 * notification already goes through one entry point, and this hangs off the
 * end of it. If the keys are not configured, or a device has gone away, the
 * in-app notification is unaffected — push is an extra, never the record.
 *
 * A dead subscription is deleted rather than retried forever. The push service
 * tells us with a 404 or 410 when someone has uninstalled or revoked, and
 * anything else is counted so a device that fails repeatedly is eventually
 * dropped too.
 */

import webpush from 'web-push'
import prisma from '@/lib/prisma'

/** How many consecutive failures before we stop bothering with a device. */
const GIVE_UP_AFTER = 5

let configured: boolean | null = null

function ready(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hello@lighthousecare.org.au'
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export type PushPayload = {
  title: string
  body: string
  href: string
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string
}

/**
 * Push to every device belonging to these people.
 *
 * Never throws: a failed push must not fail the action that triggered it.
 * Returns how many devices were reached, which is only useful for logging.
 */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!ready() || userIds.length === 0) return 0

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, endpoint: true, p256dh: true, auth: true, failures: true },
    })
    if (subs.length === 0) return 0

    const body = JSON.stringify(payload)
    const dead: string[] = []
    const failed: string[] = []
    let sent = 0

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 12 },
          )
          sent++
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          // Gone for good: uninstalled, or permission revoked.
          if (code === 404 || code === 410) dead.push(s.id)
          else failed.push(s.id)
        }
      }),
    )

    if (dead.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } })
    }
    if (failed.length > 0) {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: failed } },
        data: { failures: { increment: 1 } },
      })
      // Anything stuck failing is treated as gone.
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: failed }, failures: { gte: GIVE_UP_AFTER } },
      })
    }
    if (sent > 0) {
      await prisma.pushSubscription.updateMany({
        where: { userId: { in: userIds }, id: { notIn: [...dead, ...failed] } },
        data: { lastUsedAt: new Date(), failures: 0 },
      })
    }

    return sent
  } catch (err) {
    console.error('pushToUsers failed', err)
    return 0
  }
}

/** Whether push is configured at all, for the settings UI to be honest. */
export function pushConfigured(): boolean {
  return ready()
}
