/**
 * Turning on notifications, from the browser's side.
 *
 * Lifted out of `PushToggle` so the settings switch and the contextual ask
 * after somebody joins something share one implementation. The permission
 * prompt is a **one-shot per site** — asked at a bad moment and dismissed, it
 * cannot be asked again — so every caller of this has to be a deliberate tap,
 * never a page load.
 *
 * Client-only. No imports from the server here, or a Client Component that
 * pulls this in drags Prisma into the browser bundle.
 */

export type PushSupport =
  /** Works here, and nothing has been asked yet. */
  | { kind: 'ready' }
  /** Already on for this device. */
  | { kind: 'on' }
  /** iOS in a Safari tab: push exists only once the site is installed. */
  | { kind: 'needs-install' }
  /** Asked and refused. We cannot ask again from here. */
  | { kind: 'blocked' }
  /** No push in this browser at all. */
  | { kind: 'unsupported' }

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

/**
 * What this device can do, without touching the service worker registry.
 *
 * Deliberately synchronous: a card that has to decide whether to appear at all
 * should not flash into view and out again while an await settles.
 */
export function pushSupport(publicKey: string | null): PushSupport {
  if (!publicKey || typeof window === 'undefined') return { kind: 'unsupported' }

  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  if (!supported) {
    // On iOS these APIs only exist once the site is on the home screen, which
    // needs different advice from a browser that simply cannot do push.
    return isIOS() && !isStandalone() ? { kind: 'needs-install' } : { kind: 'unsupported' }
  }

  if (Notification.permission === 'denied') return { kind: 'blocked' }
  if (Notification.permission === 'granted') return { kind: 'on' }
  return { kind: 'ready' }
}

/**
 * Nothing here is allowed to hang.
 *
 * An earlier version awaited each browser call directly, and on iOS one of
 * them never settled — so the button span forever, no error was thrown, and
 * there was nothing to report. A rejected promise is recoverable; a pending
 * one is not.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`STEP:${step}`)), ms)),
  ])
}

/**
 * Permission, whichever form this browser supports.
 *
 * Safari shipped the callback signature years before the promise one, and on
 * an older iOS the promise simply never resolves. Asking for both means the
 * callback settles it even where the promise will not.
 */
export function requestPermission(): Promise<NotificationPermission> {
  return new Promise((resolve, reject) => {
    try {
      let settled = false
      const done = (p: NotificationPermission) => {
        if (!settled) {
          settled = true
          resolve(p)
        }
      }
      const maybe = Notification.requestPermission(done)
      if (maybe && typeof maybe.then === 'function') void maybe.then(done, reject)
    } catch (err) {
      reject(err)
    }
  })
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** A rough device name, so someone can tell their phone from their laptop. */
export function deviceLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}

export type SubscribeResult =
  | { ok: true; endpoint: string; p256dh: string; auth: string; label: string }
  | { ok: false; reason: 'denied' | 'dismissed' | 'failed'; step?: string }

/**
 * Ask, register, subscribe — the whole dance, once.
 *
 * Returns rather than throws, and names the step it stopped at, because "it
 * didn't work" on somebody else's phone is otherwise unfixable from here.
 */
export async function subscribeThisDevice(publicKey: string): Promise<SubscribeResult> {
  try {
    const permission = await withTimeout(requestPermission(), 60_000, 'permission')
    if (permission !== 'granted') {
      return { ok: false, reason: permission === 'denied' ? 'denied' : 'dismissed' }
    }

    const reg = await withTimeout(
      navigator.serviceWorker.register('/sw.js'),
      20_000,
      'service worker',
    )
    // Not fatal on its own: a registration can be usable before anything
    // controls the page, so a slow claim should not stop us subscribing.
    await withTimeout(navigator.serviceWorker.ready, 15_000, 'worker ready').catch(() => {})

    const sub = await withTimeout(
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }),
      20_000,
      'subscribe',
    )

    const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } }
    return {
      ok: true,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      label: deviceLabel(),
    }
  } catch (err) {
    const message = (err as Error).message ?? ''
    console.error('push subscribe failed', err)
    return {
      ok: false,
      reason: 'failed',
      step: message.startsWith('STEP:') ? message.slice(5) : undefined,
    }
  }
}

/**
 * Remembering a "not now".
 *
 * Per device and per place we ask, because declining a nudge about wish lists
 * is not declining every nudge forever. Wrapped because storage throws in a
 * private window, and a card that crashes the page it sits on is worse than
 * one that asks twice.
 */
export function wasDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(`push-ask:${key}`) !== null
  } catch {
    return false
  }
}

export function rememberDismissed(key: string): void {
  try {
    window.localStorage.setItem(`push-ask:${key}`, String(Date.now()))
  } catch {
    // Nothing to do, and nothing worth telling anybody.
  }
}
