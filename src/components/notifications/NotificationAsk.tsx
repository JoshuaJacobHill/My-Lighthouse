'use client'

import * as React from 'react'
import { Bell, Check } from 'lucide-react'
import { subscribePushAction, testPushAction } from '@/lib/actions/push.actions'
import {
  deviceLabel,
  pushSupport,
  rememberDismissed,
  subscribeThisDevice,
  wasDismissed,
} from '@/lib/push-client'
import { InstallPrompt } from '@/components/notifications/InstallPrompt'

/**
 * The soft ask: our card, at a moment when the answer is obviously yes.
 *
 * The browser's permission prompt is **one shot per site** — dismissed once
 * and it can never be raised again from the page — so it is never fired
 * directly. This asks first, in our own words, with a reason that makes sense
 * where it stands. Declining costs nothing, because the real chance is still
 * unspent.
 *
 * Asked right after somebody commits to something, which is the only kind of
 * moment where "shall we tell you when it's ready?" answers itself. Never on
 * page load, and never twice: "Not now" is remembered per place we ask,
 * because declining a nudge about wish lists is not declining every nudge
 * forever.
 */
export function NotificationAsk({
  publicKey,
  /** Why, here. One sentence, specific to what they just did. */
  reason,
  /** Distinguishes this ask from the others, for remembering a decline. */
  dismissKey,
  tone = 'light',
}: {
  publicKey: string | null
  reason: string
  dismissKey: string
  /** `dark` for the takeover screens, which are red and green. */
  tone?: 'light' | 'dark'
}) {
  const [show, setShow] = React.useState(false)
  const [needsInstall, setNeedsInstall] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    if (wasDismissed(dismissKey)) return
    const support = pushSupport(publicKey)
    // Nothing to ask when it is already on, already refused, or impossible.
    //
    // Decided in an effect rather than during render because it reads
    // `Notification.permission` and the user agent, neither of which exists on
    // the server — computing it during render would ship a hydration mismatch.
    // The rule cannot see that, so it is silenced here rather than the code
    // being bent around it.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (support.kind === 'ready') setShow(true)
    else if (support.kind === 'needs-install') setNeedsInstall(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [publicKey, dismissKey])

  async function turnOn() {
    if (!publicKey) return
    setBusy(true)
    try {
      const result = await subscribeThisDevice(publicKey)
      if (!result.ok) {
        // Denied or dismissed: the browser will not ask again, so neither
        // should we. Remembering it keeps this card from reappearing to
        // somebody it can no longer help.
        rememberDismissed(dismissKey)
        setShow(false)
        return
      }

      const saved = await subscribePushAction({
        endpoint: result.endpoint,
        p256dh: result.p256dh,
        auth: result.auth,
        label: result.label,
      })
      if (!saved.success) {
        setShow(false)
        return
      }

      setDone(true)
      // The proof, immediately, at the moment they said yes.
      void testPushAction().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  if (needsInstall) {
    return (
      <div className="mt-6">
        <InstallPrompt reason={reason} dismissKey={`${dismissKey}:install`} />
      </div>
    )
  }

  if (done) {
    return (
      <p
        className={`mt-6 flex items-center justify-center gap-2 text-sm font-semibold ${
          tone === 'dark' ? 'text-white/90' : 'text-green-700'
        }`}
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        We&rsquo;ll nudge your {deviceLabel().toLowerCase()}.
      </p>
    )
  }

  if (!show) return null

  const dark = tone === 'dark'

  return (
    <div
      className={`mt-6 rounded-[28px] p-5 ${
        dark ? 'bg-white/12 text-white' : 'border border-neutral-200 bg-white text-neutral-950'
      }`}
    >
      <h3 className="flex items-center gap-2 font-bold">
        <Bell className={`h-4 w-4 ${dark ? 'text-white' : 'text-orange-600'}`} aria-hidden="true" />
        Want a nudge on your phone?
      </h3>
      <p className={`mt-1.5 text-sm ${dark ? 'text-white/80' : 'text-neutral-600'}`}>{reason}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className={`rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50 ${
            dark
              ? 'bg-white text-neutral-900 hover:bg-white/90'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
        >
          {busy ? 'Just a moment…' : 'Yes, turn them on'}
        </button>
        <button
          type="button"
          onClick={() => {
            rememberDismissed(dismissKey)
            setShow(false)
          }}
          className={`rounded-full px-4 py-2.5 text-sm font-semibold ${
            dark ? 'text-white/70 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
