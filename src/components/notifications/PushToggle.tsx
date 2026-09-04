'use client'

import * as React from 'react'
import { Bell, BellOff, Loader2, Send } from 'lucide-react'
import {
  subscribePushAction,
  unsubscribePushAction,
  pushStatusAction,
  testPushAction,
} from '@/lib/actions/push.actions'
import { useToast } from '@/components/ui/use-toast'

/**
 * Turn phone notifications on for this device.
 *
 * Per device, not per person: the same someone on a phone and a laptop has two
 * subscriptions, and the copy says so, because "notifications are on" would
 * otherwise be a lie on their other phone.
 *
 * The permission prompt is only ever raised by a tap. A browser gives one
 * chance per site — asked at a bad moment and refused, it cannot be asked
 * again — so it is never triggered on page load.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** A rough device name, so someone can tell their phone from their laptop. */
function deviceLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[28px] border border-neutral-200 p-5">{children}</div>
}

type State =
  | 'checking'
  | 'unsupported'
  | 'needs-install'
  | 'blocked'
  | 'off'
  | 'on'

/** What can be worked out without touching the service worker registry. */
function initialState(publicKey: string | null): State {
  if (!publicKey) return 'unsupported'
  if (typeof window === 'undefined') return 'checking'

  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  if (!supported) {
    // On iOS these APIs only exist once the site is on the home screen, so an
    // iPhone in a Safari tab lands here — and needs different advice from a
    // browser that simply cannot do push at all.
    const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    return iOS && !standalone ? 'needs-install' : 'unsupported'
  }

  if (Notification.permission === 'denied') return 'blocked'
  return 'checking'
}

export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const { toast } = useToast()
  const [state, setState] = React.useState<State>(() => initialState(publicKey))
  const [busy, setBusy] = React.useState(false)
  const [devices, setDevices] = React.useState(0)
  const [endpoint, setEndpoint] = React.useState<string | null>(null)

  // Only the part that needs the service worker registry and the database.
  const check = React.useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    const status = await pushStatusAction(sub?.endpoint ?? null)
    setEndpoint(sub?.endpoint ?? null)
    setDevices(status.devices)
    setState(sub && status.registered ? 'on' : 'off')
  }, [])

  React.useEffect(() => {
    // Nothing to look up when the answer is already known from the platform.
    if (initialState(publicKey) !== 'checking') return
    // Reading the service worker registry is asynchronous platform I/O, which
    // is precisely what an effect is for; every setState inside check() happens
    // after an await. The rule cannot see that, so it is silenced here rather
    // than the code being bent around it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check()
  }, [check, publicKey])

  async function turnOn() {
    if (!publicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })

      const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } }
      const res = await subscribePushAction({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        label: deviceLabel(),
      })

      if (!res.success) {
        toast.error('Could not turn on', res.error ?? 'Please try again.')
        return
      }
      setEndpoint(sub.endpoint)
      setState('on')
      await check()
      toast.success('Notifications on', `${deviceLabel()} will get a nudge for new things.`)
    } catch (err) {
      console.error('push subscribe failed', err)
      toast.error('Could not turn on', 'Something went wrong setting this up.')
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await sub.unsubscribe()
        await unsubscribePushAction(sub.endpoint)
      } else if (endpoint) {
        await unsubscribePushAction(endpoint)
      }
      setEndpoint(null)
      setState('off')
      await check()
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    const res = await testPushAction()
    setBusy(false)
    if (res.success) toast.success('Sent', 'It should appear in a moment.')
    else toast.error('Nothing arrived', res.error ?? 'Please try again.')
  }

  if (state === 'checking') {
    return (
      <Wrap>
        <p className="text-sm text-neutral-400">Checking…</p>
      </Wrap>
    )
  }

  if (state === 'needs-install') {
    return (
      <Wrap>
        <h3 className="flex items-center gap-2 font-bold">
          <Bell className="h-4 w-4 text-orange-600" aria-hidden="true" />
          Phone notifications
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          On an iPhone or iPad these only work once the portal is on your home screen. Tap the
          share button in Safari, choose <strong>Add to Home Screen</strong>, then open it from
          there and come back to this page.
        </p>
      </Wrap>
    )
  }

  if (state === 'unsupported') {
    return (
      <Wrap>
        <h3 className="flex items-center gap-2 font-bold">
          <BellOff className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          Phone notifications
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          This browser can&apos;t do notifications. You&apos;ll still see everything in the app,
          and important things still come by email.
        </p>
      </Wrap>
    )
  }

  if (state === 'blocked') {
    return (
      <Wrap>
        <h3 className="flex items-center gap-2 font-bold">
          <BellOff className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          Phone notifications
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          Notifications are blocked for this site, so we can&apos;t ask again from here. Allow
          them in your browser or phone settings for My Lighthouse, then reload this page.
        </p>
      </Wrap>
    )
  }

  return (
    <Wrap>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold">
            <Bell className="h-4 w-4 text-orange-600" aria-hidden="true" />
            Phone notifications
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            {state === 'on'
              ? `On for ${deviceLabel().toLowerCase()}.`
              : 'Get a nudge when something needs you, without opening the app.'}
          </p>
          {devices > 1 && (
            <p className="mt-1 text-xs text-neutral-400">
              On for {devices} devices. This switch only affects this one.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {state === 'on' && (
            <button
              type="button"
              onClick={test}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Test
            </button>
          )}
          <button
            type="button"
            onClick={state === 'on' ? turnOff : turnOn}
            disabled={busy}
            className={
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ' +
              (state === 'on'
                ? 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                : 'bg-orange-600 text-white hover:bg-orange-700')
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {state === 'on' ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </div>
    </Wrap>
  )
}
