'use client'

import * as React from 'react'
import { ArrowUpFromLine, Plus, Share } from 'lucide-react'
import { isIOS, isStandalone, rememberDismissed, wasDismissed } from '@/lib/push-client'

/**
 * Getting the portal onto a home screen.
 *
 * Two completely different jobs behind one component, because the platforms
 * differ in what they will let us do:
 *
 * **Android and desktop Chrome** fire `beforeinstallprompt`, which can be
 * saved and fired later from a button of ours. One tap, native dialog, done.
 *
 * **iOS gives us nothing.** Apple provides no way to trigger Add to Home
 * Screen from code, so the honest version is instructions with the share icon
 * drawn, which is what every app you have seen do this is also doing. A button
 * that cannot work would be worse than a sentence that explains.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }

export function InstallPrompt({
  /** Why they would want to, in their situation. */
  reason,
  dismissKey = 'install',
}: {
  reason?: string
  dismissKey?: string
}) {
  const [event, setEvent] = React.useState<InstallEvent | null>(null)
  const [hidden, setHidden] = React.useState(true)
  const [ios, setIos] = React.useState(false)

  React.useEffect(() => {
    // Already installed, or told once already that they are not interested.
    if (isStandalone() || wasDismissed(dismissKey)) return

    if (isIOS()) {
      setIos(true)
      setHidden(false)
      return
    }

    const onPrompt = (e: Event) => {
      // Chrome shows its own bar otherwise, at a moment of its choosing.
      e.preventDefault()
      setEvent(e as InstallEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [dismissKey])

  function dismiss() {
    rememberDismissed(dismissKey)
    setHidden(true)
  }

  if (hidden) return null

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5 text-neutral-950">
      <h3 className="flex items-center gap-2 font-bold">
        <ArrowUpFromLine className="h-4 w-4 text-orange-600" aria-hidden="true" />
        Add My Lighthouse to your home screen
      </h3>
      <p className="mt-1.5 text-sm text-neutral-600">
        {reason ?? 'It opens like an app, and it is how your phone can send you a nudge.'}
      </p>

      {ios ? (
        <ol className="mt-3 grid gap-2 text-sm text-neutral-600">
          <li className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[11px] font-bold">
              1
            </span>
            Tap <Share className="h-4 w-4 text-blue-600" aria-hidden="true" /> at the bottom of
            Safari
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[11px] font-bold">
              2
            </span>
            Scroll down and choose <b>Add to Home Screen</b>
            <Plus className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-neutral-100 text-[11px] font-bold">
              3
            </span>
            Open it from there, not from Safari
          </li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={async () => {
            if (!event) return
            await event.prompt()
            // Whatever they chose, our card has done its job.
            dismiss()
          }}
          className="mt-4 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-700"
        >
          Add to home screen
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        className="mt-3 block text-[13px] font-semibold text-neutral-400 hover:text-neutral-700"
      >
        Not now
      </button>
    </div>
  )
}
