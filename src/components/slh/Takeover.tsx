'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

/**
 * The full-bleed welcome screens: solid colour, snow, white type.
 *
 * Shared by shopper onboarding and the child's own wish list, because both are
 * moments where somebody is being welcomed into something rather than filling
 * in a form — and a child writing to Santa deserves it more than anybody.
 */

/** Fixed flakes, so the same screen looks the same every time. */
const FLAKES = [
  [6, 3, 11, 0], [18, 2, 14, 2], [29, 4, 9, 1], [41, 2.5, 13, 4], [52, 3.5, 10, 2.5],
  [63, 2, 15, 0.5], [74, 4, 12, 3], [85, 2.5, 10, 1.5], [93, 3, 14, 4.5], [12, 2, 16, 5],
  [36, 3, 11, 6], [58, 2.5, 13, 5.5], [80, 3.5, 9, 6.5], [47, 2, 17, 3.5],
] as const

export function Snow() {
  return (
    <div
      className="slh-snow pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {FLAKES.map(([left, size, dur, delay], i) => (
        <i
          key={i}
          style={{
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDuration: `${dur}s`,
            animationDelay: `-${delay}s`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Sleigh bells, if somebody has put a file there.
 *
 * Hides itself when `/audio/slh.mp3` is missing rather than offering a button
 * that does nothing — so the music is a file drop rather than a deploy.
 *
 * **Never autoplays.** Browsers block it, and sound starting by itself on a
 * page a child opened on a phone in a quiet house is a worse first impression
 * than silence.
 */
export function MusicToggle() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const el = new Audio('/audio/slh.mp3')
    el.loop = true
    el.volume = 0.35
    const ok = () => setAvailable(true)
    el.addEventListener('canplaythrough', ok)
    audio.current = el
    return () => {
      el.removeEventListener('canplaythrough', ok)
      el.pause()
    }
  }, [])

  if (!available) return null

  return (
    <button
      type="button"
      onClick={() => {
        const el = audio.current
        if (!el) return
        if (playing) {
          el.pause()
          setPlaying(false)
        } else {
          void el.play().then(() => setPlaying(true)).catch(() => setAvailable(false))
        }
      }}
      aria-pressed={playing}
      aria-label={playing ? 'Turn the music off' : 'Turn the music on'}
      className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/40 text-white hover:bg-white/15"
    >
      {playing ? (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  )
}

export function Dots({ step, of }: { step: number; of: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < step ? 'w-6 bg-white' : 'w-1.5 bg-white/35'
          }`}
        />
      ))}
    </div>
  )
}

export function Takeover({
  tone,
  children,
  music = false,
}: {
  tone: 'red' | 'green'
  children: React.ReactNode
  music?: boolean
}) {
  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col overflow-hidden text-white ${
        tone === 'red' ? 'bg-[#c8102e]' : 'bg-[#14713c]'
      }`}
    >
      <Snow />
      {music && <MusicToggle />}
      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10 sm:px-8">
        {children}
      </div>
    </div>
  )
}

export function WhiteButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-white py-3.5 text-base font-bold text-neutral-900 transition-opacity hover:bg-white/90 disabled:opacity-45"
    >
      {children}
    </button>
  )
}
