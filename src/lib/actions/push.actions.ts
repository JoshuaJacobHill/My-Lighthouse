'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type Result = { success: boolean; error?: string }

/**
 * Store a device's push subscription.
 *
 * Keyed on the endpoint, which the browser issues per device per site, so
 * re-subscribing on the same phone updates that row rather than piling up
 * duplicates. If the endpoint previously belonged to someone else — a shared
 * family iPad, a staff member handing a device on — it moves across, because
 * the browser only ever has one subscription per site and the last person to
 * grant permission is the one who should receive it.
 */
export async function subscribePushAction(input: {
  endpoint: string
  p256dh: string
  auth: string
  label?: string
}): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  const { endpoint, p256dh, auth } = input
  if (!endpoint || !p256dh || !auth) {
    return { success: false, error: 'That subscription looks incomplete.' }
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh,
        auth,
        label: input.label?.slice(0, 80) ?? null,
        userId: session.userId,
      },
      update: {
        p256dh,
        auth,
        label: input.label?.slice(0, 80) ?? null,
        userId: session.userId,
        failures: 0,
      },
    })
    return { success: true }
  } catch (err) {
    console.error('subscribePushAction failed', err)
    return { success: false, error: 'Could not turn on notifications.' }
  }
}

/** Forget this device. Scoped to the signed-in person. */
export async function unsubscribePushAction(endpoint: string): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.userId },
  })
  return { success: true }
}

/** Is this device already set up? Used to render the toggle correctly. */
export async function pushStatusAction(
  endpoint: string | null,
): Promise<{ registered: boolean; devices: number }> {
  const session = await getSession()
  if (!session) return { registered: false, devices: 0 }

  const [devices, mine] = await Promise.all([
    prisma.pushSubscription.count({ where: { userId: session.userId } }),
    endpoint
      ? prisma.pushSubscription.count({ where: { endpoint, userId: session.userId } })
      : Promise.resolve(0),
  ])
  return { registered: mine > 0, devices }
}

/**
 * Send a test notification to the signed-in person's devices, and say exactly
 * what happened.
 *
 * The old version returned "Nothing was delivered. The device may have revoked
 * permission." — a guess, presented as a diagnosis, for a chain with five
 * links in it. Push depends on the server's keys, a service worker, a browser
 * permission, a stored subscription and somebody else's push service, and the
 * only useful test is one that names which of those is the problem.
 */
export async function testPushAction(): Promise<
  Result & { sent?: number; devices?: number; detail?: string }
> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not signed in.' }

  const { pushToUsers, pushConfigured } = await import('@/lib/push')

  const config = pushConfigured()
  if (!config.ok) {
    return {
      success: false,
      error: 'Push is not set up on the server.',
      detail: config.reason,
    }
  }

  const result = await pushToUsers([session.userId], {
    title: 'My Lighthouse',
    body: 'Notifications are working on this device.',
    href: '/dashboard/notifications',
    tag: 'test',
  })

  if (result.devices === 0) {
    return {
      success: false,
      error: 'This account has no registered devices.',
      detail:
        'Turn notifications off and on again on this device — the subscription is missing from the server.',
    }
  }

  if (result.sent === 0) {
    return {
      success: false,
      error: `None of your ${result.devices} ${result.devices === 1 ? 'device' : 'devices'} accepted it.`,
      // The push service's own words, rather than our guess at them.
      detail: result.problems.join(' ') || 'No reason was given by the push service.',
    }
  }

  return {
    success: true,
    sent: result.sent,
    devices: result.devices,
    detail:
      result.problems.length > 0
        ? `Sent to ${result.sent} of ${result.devices}. ${result.problems.join(' ')}`
        : undefined,
  }
}
