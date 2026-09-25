/**
 * Web push delivery.
 *
 * Sits behind `notify()` so nothing else has to know about it: every
 * notification already goes through one entry point, and this hangs off the
 * end of it. If the keys are not configured, or a device has gone away, the
 * in-app notification is unaffected — push is an extra, never the record.
 *
 * **Everything here reports why it failed.** Push has keys, a service worker,
 * a permission, a subscription and somebody else's server in the chain, and
 * any of them can be the broken one. A sender that returns "0 sent" leaves a
 * person guessing at five possibilities at once, which is how this ended up
 * being reported as "the test button doesn't work".
 */

import webpush from 'web-push'
import prisma from '@/lib/prisma'

/** How many consecutive failures before we stop bothering with a device. */
const GIVE_UP_AFTER = 5

type Ready = { ok: true } | { ok: false; reason: string }

let cached: Ready | null = null

/**
 * Configure `web-push`, once.
 *
 * **Never throws.** `setVapidDetails` rejects a subject that is not a
 * `mailto:` or `https:` URL, and a key that is not valid base64url — and this
 * used to be called outside the try/catch in `pushToUsers`, so a bad
 * environment variable surfaced as an unhandled exception inside a server
 * action rather than as a message anybody could act on.
 */
function ready(): Ready {
  if (cached !== null) return cached

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hello@lighthousecare.org.au'

  if (!publicKey || !privateKey) {
    const missing = [
      !publicKey ? 'NEXT_PUBLIC_VAPID_PUBLIC_KEY' : null,
      !privateKey ? 'VAPID_PRIVATE_KEY' : null,
    ]
      .filter(Boolean)
      .join(' and ')
    cached = { ok: false, reason: `${missing} is not set on the server.` }
    return cached
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    cached = { ok: true }
  } catch (err) {
    // Almost always the subject: it has to be mailto:… or https://…
    cached = {
      ok: false,
      reason: `The VAPID settings were rejected: ${(err as Error).message}`,
    }
    console.error('push not configured', err)
  }
  return cached
}

export type PushPayload = {
  title: string
  body: string
  href: string
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string
}

export type PushResult = {
  /** Devices the push service accepted. */
  sent: number
  /** Subscriptions found for these people, before any were tried. */
  devices: number
  /** Removed: the push service says they are gone, or the keys no longer match. */
  dropped: number
  /** Why the ones that failed, failed — one line per distinct reason. */
  problems: string[]
  /** Set when push is not configured at all. */
  notConfigured?: string
}

/** What a status code from a push service actually means for us. */
function explain(code: number | undefined, message: string): { dead: boolean; text: string } {
  switch (code) {
    case 404:
    case 410:
      return { dead: true, text: 'The device is gone — uninstalled, or notifications turned off.' }
    case 403:
      // The subscription was created with a different application server key.
      // It will never work with these, so retrying is pointless — dropping it
      // lets the person turn notifications on again and get a fresh one.
      return {
        dead: true,
        text: 'This device was registered with different VAPID keys. Turn notifications off and on again on that device.',
      }
    case 401:
      return { dead: false, text: 'The push service rejected our VAPID keys (401).' }
    case 400:
      return { dead: false, text: `The push service refused the request (400): ${message}` }
    case 413:
      return { dead: false, text: 'The notification was too large for the push service.' }
    case 429:
      return { dead: false, text: 'The push service is rate-limiting us. Try again shortly.' }
    default:
      return { dead: false, text: `Push service error${code ? ` (${code})` : ''}: ${message}` }
  }
}

/**
 * Push to every device belonging to these people.
 *
 * Never throws: a failed push must not fail the action that triggered it.
 */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<PushResult> {
  const config = ready()
  if (!config.ok) {
    return { sent: 0, devices: 0, dropped: 0, problems: [], notConfigured: config.reason }
  }
  if (userIds.length === 0) return { sent: 0, devices: 0, dropped: 0, problems: [] }

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
    if (subs.length === 0) return { sent: 0, devices: 0, dropped: 0, problems: [] }

    const body = JSON.stringify(payload)
    const dead: string[] = []
    const failed: string[] = []
    const problems = new Set<string>()
    const delivered: string[] = []

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 12 },
          )
          delivered.push(s.id)
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          const why = explain(code, (err as Error).message ?? '')
          problems.add(why.text)
          if (why.dead) dead.push(s.id)
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
    if (delivered.length > 0) {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: delivered } },
        data: { lastUsedAt: new Date(), failures: 0 },
      })
    }

    return {
      sent: delivered.length,
      devices: subs.length,
      dropped: dead.length,
      problems: [...problems],
    }
  } catch (err) {
    console.error('pushToUsers failed', err)
    return {
      sent: 0,
      devices: 0,
      dropped: 0,
      problems: [`Something went wrong sending: ${(err as Error).message}`],
    }
  }
}

/** Whether push is configured at all, and why not when it is not. */
export function pushConfigured(): { ok: boolean; reason?: string } {
  const config = ready()
  return config.ok ? { ok: true } : { ok: false, reason: config.reason }
}
