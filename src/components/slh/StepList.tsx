'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { markStepAction } from '@/lib/actions/slh.actions'
import { WISH_STEPS, type WishStepKey } from '@/lib/slh-steps'

/**
 * The chain a shopper works through, and the ticking of it.
 *
 * Every step is togglable rather than a one-way ratchet. People tick the wrong
 * row, and a shopper who cannot untick "delivered" will either leave it wrong
 * or ring somebody — both worse than letting them fix it.
 *
 * Read-only for anybody who is not the shopper this list belongs to; the page
 * decides that and the action checks it again.
 */
export function StepList({
  childId,
  done,
  readOnly = false,
}: {
  childId: string
  done: WishStepKey[]
  readOnly?: boolean
}) {
  const router = useRouter()
  const [marks, setMarks] = useState<WishStepKey[]>(done)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<WishStepKey | null>(null)
  const [, startTransition] = useTransition()

  const firstOpen = WISH_STEPS.findIndex((s) => !marks.includes(s.key))

  function toggle(key: WishStepKey) {
    if (readOnly) return
    const on = !marks.includes(key)

    // Move first, reconcile after: a tick that waits on the network feels
    // broken, and the server's answer puts it back if it disagrees.
    setMarks((m) => (on ? [...m, key] : m.filter((k) => k !== key)))
    setError(null)
    setBusy(key)

    startTransition(async () => {
      const fd = new FormData()
      fd.set('childId', childId)
      fd.set('step', key)
      fd.set('on', String(on))
      const result = await markStepAction(fd)
      setBusy(null)
      if (!result.success) {
        setMarks((m) => (on ? m.filter((k) => k !== key) : [...m, key]))
        setError(result.error ?? 'Could not save that step.')
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <ol className="mt-2 divide-y divide-neutral-100">
        {WISH_STEPS.map((step, i) => {
          const isDone = marks.includes(step.key)
          const now = i === firstOpen
          const Tag = readOnly ? 'div' : 'button'
          return (
            <li key={step.key}>
              <Tag
                {...(readOnly
                  ? {}
                  : {
                      type: 'button' as const,
                      onClick: () => toggle(step.key),
                      'aria-pressed': isDone,
                      disabled: busy !== null,
                    })}
                className={`flex w-full items-start gap-4 py-3.5 text-left ${
                  readOnly ? '' : 'transition-colors hover:bg-neutral-50'
                }`}
              >
                <span
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                    isDone
                      ? 'border-green-600 bg-green-600 text-white'
                      : now
                        ? 'border-[#c8102e] text-transparent'
                        : 'border-neutral-200 text-transparent'
                  }`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[15px] font-bold ${isDone ? 'text-neutral-500' : ''} ${
                      i > firstOpen && firstOpen !== -1 ? 'text-neutral-400' : ''
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-neutral-400">{step.hint}</span>
                </span>
              </Tag>
            </li>
          )
        })}
      </ol>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-[#c8102e]">
          {error}
        </p>
      )}
    </>
  )
}
