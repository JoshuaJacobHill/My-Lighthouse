'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { releaseWishListAction } from '@/lib/actions/slh.actions'

/**
 * Giving a wish list back.
 *
 * Behind a confirmation naming the child, because it sends a real list to
 * somebody else and clears whatever the shopper had ticked. Not behind an
 * apology, though: the onboarding screen asks people to do this early, and a
 * button that makes somebody feel judged is a button they will avoid until
 * December.
 */
export function ReleaseList({ childId, name }: { childId: string; name: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function release() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('childId', childId)
      const result = await releaseWishListAction(fd)
      if (result.success) {
        setConfirming(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not give that list back.')
      }
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[13px] font-semibold text-neutral-400 underline underline-offset-2 hover:text-neutral-700"
      >
        I can&rsquo;t do this one
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <p className="text-[13px] leading-relaxed">
        Give {name}&rsquo;s wish list back so another shopper can take it? Anything you&rsquo;ve
        ticked off will be cleared.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={release}
          disabled={pending}
          className="rounded-full bg-[#c8102e] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#9d0b23] disabled:opacity-50"
        >
          {pending ? 'Giving back…' : 'Yes, give it back'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-full border border-neutral-300 px-4 py-2 text-[13px] font-bold hover:bg-white"
        >
          Keep it
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-[#c8102e]">
          {error}
        </p>
      )}
    </div>
  )
}
