'use client'

import * as React from 'react'
import { Plus, Share, Smartphone, X } from 'lucide-react'
import { isIOS, isStandalone, rememberDismissed, wasDismissed } from '@/lib/push-client'

/**
 * Install buttons, in the shape everybody already recognises.
 *
 * **Deliberately not Apple's or Google's official badges.** Both restrict
 * those marks to apps listed in their stores, and this is a web app installed
 * from the browser — so using them would breach the guidelines and, worse,
 * promise an App Store listing to somebody who is about to get Safari
 * instructions. The layout is the familiar one; the words are true.
 *
 * Android and desktop Chrome get a real install: `beforeinstallprompt` is
 * captured and fired from the button, which opens the native dialog.
 *
 * Apple gives no equivalent API, so that button opens the instructions
 * instead. Every app doing this is doing the same, because there is no other
 * way — and a dialog that shows the share icon beats a sentence describing it.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }

function Badge({
  onClick,
  small,
  large,
  icon,
}: {
  onClick: () => void
  small: string
  large: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-3 rounded-xl bg-neutral-950 px-4 py-2.5 text-left text-white transition-colors hover:bg-neutral-800"
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-white/70">
          {small}
        </span>
        <span className="block text-[15px] font-bold tracking-tight">{large}</span>
      </span>
    </button>
  )
}

export function InstallBadges({ dismissKey = 'install-badges' }: { dismissKey?: string }) {
  const [hidden, setHidden] = React.useState(true)
  const [event, setEvent] = React.useState<InstallEvent | null>(null)
  const [ios, setIos] = React.useState(false)
  const [showSteps, setShowSteps] = React.useState(false)

  React.useEffect(() => {
    // Already installed, or told once that they are not interested.
    if (isStandalone() || wasDismissed(dismissKey)) return

    /* eslint-disable react-hooks/set-state-in-effect */
    if (isIOS()) {
      // Reading the user agent during render would mean doing it on the
      // server, where it does not exist, and shipping a hydration mismatch.
      setIos(true)
      setHidden(false)
    }
    /* eslint-enable react-hooks/set-state-in-effect */

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
    setShowSteps(false)
  }

  if (hidden) return null

  return (
    <>
      <section className="mb-14 rounded-[28px] border border-neutral-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold tracking-tight">Keep My Lighthouse on your phone</h2>
            <p className="mt-1 text-sm text-neutral-500">
              It opens like an app, and it&rsquo;s how we can send you a nudge when something needs
              you.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="shrink-0 rounded-full p-1.5 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {ios && (
            <Badge
              onClick={() => setShowSteps(true)}
              small="Add to"
              large="iPhone Home Screen"
              icon={<Share className="h-6 w-6" />}
            />
          )}
          {event && (
            <Badge
              onClick={async () => {
                await event.prompt()
                // Whatever they chose, this card has done its job.
                dismiss()
              }}
              small="Install on"
              large="Android"
              icon={<Smartphone className="h-6 w-6" />}
            />
          )}
        </div>
      </section>

      {showSteps && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-neutral-950/40 p-4 sm:place-items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-steps-title"
            className="w-full max-w-sm rounded-[28px] bg-white p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="install-steps-title" className="text-xl font-extrabold tracking-tight">
                Add to your home screen
              </h3>
              <button
                type="button"
                onClick={() => setShowSteps(false)}
                aria-label="Close"
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-1.5 text-sm text-neutral-500">
              iPhone only lets apps send notifications once they&rsquo;re on your home screen.
              Three taps.
            </p>

            <ol className="mt-5 grid gap-4">
              {[
                {
                  icon: <Share className="h-5 w-5 text-blue-600" aria-hidden="true" />,
                  text: (
                    <>
                      Tap the <b>share button</b> at the bottom of Safari
                    </>
                  ),
                },
                {
                  icon: <Plus className="h-5 w-5 text-neutral-700" aria-hidden="true" />,
                  text: (
                    <>
                      Scroll down and choose <b>Add to Home Screen</b>
                    </>
                  ),
                },
                {
                  icon: <Smartphone className="h-5 w-5 text-neutral-700" aria-hidden="true" />,
                  text: <>Open My Lighthouse from your home screen, not from Safari</>,
                },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100">
                    {step.icon}
                  </span>
                  <span className="pt-1.5 text-sm leading-relaxed">{step.text}</span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={dismiss}
              className="mt-6 w-full rounded-full bg-neutral-900 py-3 text-sm font-bold text-white hover:bg-neutral-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
