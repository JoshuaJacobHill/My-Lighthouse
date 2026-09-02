'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

/**
 * Pull down to refresh.
 *
 * Browsers give you this for free, but a web app added to the home screen runs
 * standalone and iOS takes it away, which is exactly where people expect it
 * most. So the gesture is reimplemented for that case.
 *
 * It calls router.refresh() rather than reloading the page: the server
 * components re-render with fresh data while the client keeps its state, so a
 * pull is quick and does not throw away whatever tab or filter someone was on.
 *
 * Only ever engages when the page is already scrolled to the very top and the
 * finger moves downward, so it cannot interfere with ordinary scrolling.
 */

const TRIGGER_AT = 70
const MAX_PULL = 110
/** Pull feels wrong at 1:1; dividing the distance gives it some weight. */
const RESISTANCE = 2.4

/** The nearest ancestor that actually scrolls, or the document if none does. */
function scrollParent(from: HTMLElement): HTMLElement {
  let node: HTMLElement | null = from.parentElement
  while (node) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return document.scrollingElement as HTMLElement
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pull, setPull] = React.useState(0)
  const [refreshing, setRefreshing] = React.useState(false)
  // router.refresh() gives no callback, but wrapping it in a transition does:
  // isPending stays true until the new server content has actually arrived. The
  // indicator can then last exactly as long as the work, instead of guessing.
  const [isPending, startTransition] = React.useTransition()
  const startY = React.useRef<number | null>(null)
  const active = React.useRef(false)
  const anchor = React.useRef<HTMLDivElement>(null)

  // The listeners read these mid-gesture. Kept as refs, not read from state, so
  // the effect below can depend on nothing that changes while a finger is down
  // and therefore binds its listeners exactly once instead of on every frame.
  const pullRef = React.useRef(0)
  const refreshingRef = React.useRef(false)
  const setPullBoth = React.useCallback((next: number) => {
    pullRef.current = next
    setPull(next)
  }, [])

  React.useEffect(() => {
    // Touch only; a mouse has a refresh button. maxTouchPoints is the reliable
    // signal here: `'ontouchstart' in window` reports false on devices that
    // plainly do have touch, which would leave the gesture silently dead.
    if (typeof window === 'undefined') return
    const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
    if (!hasTouch) return

    // Found from our own element rather than taken as a prop. A ref passed in
    // from a parent can still be null when this effect first runs, and since
    // nothing in the dependency list changes afterwards the effect would never
    // re-run: the gesture would be dead for the life of the page.
    const anchorEl = anchor.current
    if (!anchorEl) return
    const target = scrollParent(anchorEl)

    function atTop() {
      return (target?.scrollTop ?? 0) <= 0
    }

    function onStart(e: TouchEvent) {
      if (refreshingRef.current || !atTop() || e.touches.length !== 1) return
      startY.current = e.touches[0].clientY
      active.current = false
    }

    function onMove(e: TouchEvent) {
      if (startY.current === null || refreshingRef.current) return
      const delta = e.touches[0].clientY - startY.current

      // Any upward movement, or leaving the top, hands control back to scroll.
      if (delta <= 0 || !atTop()) {
        startY.current = null
        active.current = false
        setPullBoth(0)
        return
      }

      active.current = true
      // Only once we are sure this is a pull, so a normal scroll is untouched.
      if (e.cancelable) e.preventDefault()
      setPullBoth(Math.min(MAX_PULL, delta / RESISTANCE))
    }

    function onEnd() {
      if (startY.current === null) return
      const shouldRefresh = active.current && pullRef.current >= TRIGGER_AT
      startY.current = null
      active.current = false

      if (!shouldRefresh) return setPullBoth(0)

      refreshingRef.current = true
      setRefreshing(true)
      setPullBoth(TRIGGER_AT)
      startTransition(() => {
        router.refresh()
      })
    }

    target.addEventListener('touchstart', onStart, { passive: true })
    target.addEventListener('touchmove', onMove, { passive: false })
    target.addEventListener('touchend', onEnd, { passive: true })
    target.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      target.removeEventListener('touchstart', onStart)
      target.removeEventListener('touchmove', onMove)
      target.removeEventListener('touchend', onEnd)
      target.removeEventListener('touchcancel', onEnd)
    }
  }, [router, setPullBoth, startTransition])

  // Held open until the transition settles, then a beat longer so the spinner
  // is legible rather than a flicker on a fast connection. The fallback timer
  // is a safety net: if a refresh never settles, the indicator still clears
  // instead of spinning forever.
  React.useEffect(() => {
    if (!refreshing) return
    const done = () => {
      refreshingRef.current = false
      setRefreshing(false)
      pullRef.current = 0
      setPull(0)
    }
    if (isPending) {
      const bail = window.setTimeout(done, 8000)
      return () => window.clearTimeout(bail)
    }
    const settle = window.setTimeout(done, 350)
    return () => window.clearTimeout(settle)
  }, [refreshing, isPending])

  const ready = pull >= TRIGGER_AT
  const visible = pull > 0 || refreshing

  return (
    <>
      <div
        aria-hidden={!refreshing}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          transform: `translateY(${Math.max(0, pull - 34)}px)`,
          opacity: visible ? 1 : 0,
          transition: startYIsSettled(pull, refreshing) ? 'transform 200ms ease, opacity 200ms ease' : 'none',
        }}
      >
        <span className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg">
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
            aria-hidden="true"
          />
        </span>
      </div>
      <div
        ref={anchor}
        style={{
          transform: pull > 0 ? `translateY(${pull * 0.4}px)` : undefined,
          transition: pull === 0 ? 'transform 200ms ease' : 'none',
        }}
      >
        {children}
      </div>
      <span className="sr-only" role="status">
        {refreshing ? 'Refreshing' : ready ? 'Release to refresh' : ''}
      </span>
    </>
  )
}

/** Animate on the way back, not while a finger is dragging. */
function startYIsSettled(pull: number, refreshing: boolean): boolean {
  return pull === 0 || refreshing
}
