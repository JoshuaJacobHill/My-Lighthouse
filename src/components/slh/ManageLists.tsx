'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import { setRequestedAction } from '@/lib/actions/slh.actions'

/**
 * Taking on more wish lists, or fewer.
 *
 * The onboarding screen asks people to tell us early if they cannot finish, so
 * the way to do that has to be a button on the page they already look at —
 * not an email to somebody. A shopper who quietly cannot manage is how a child
 * ends up without a present.
 *
 * Lists already in hand are the floor here. Giving one of those back is a
 * separate, more deliberate act, because it sends a real child's list to
 * somebody else.
 */
export function ManageLists({
  requested,
  held,
  available,
  organisation,
}: {
  requested: number
  /** Wish lists already assigned — the floor this cannot go below. */
  held: number
  /** What is left at the organisation, excluding this shopper's own request. */
  available: number
  organisation: string
}) {
  const router = useRouter()
  const [count, setCount] = useState(requested)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const max = Math.max(held, available)
  const dirty = count !== requested

  function change(next: number) {
    setError(null)
    setSaved(false)
    setCount(Math.max(held, Math.min(next, max)))
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('requested', String(count))
      const result = await setRequestedAction(fd)
      if (result.success) {
        setSaved(true)
        router.refresh()
      } else {
        setCount(requested)
        setError(result.error ?? 'Could not change that.')
      }
    })
  }

  return (
    <div className="mt-6 rounded-[28px] border border-neutral-200 p-5">
      <b className="text-sm">How many children you&rsquo;re shopping for</b>

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => change(count - 1)}
          disabled={count <= held || pending}
          aria-label="One fewer"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neutral-300 hover:bg-neutral-50 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="min-w-[2.5rem] text-center text-3xl font-extrabold tabular-nums">
          {count}
        </span>

        <button
          type="button"
          onClick={() => change(count + 1)}
          disabled={count >= max || pending}
          aria-label="One more"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neutral-300 hover:bg-neutral-50 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>

        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="ml-auto rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      <p className="mt-3 text-[13px] text-neutral-500">
        {error ? (
          <span role="alert" className="font-semibold text-[#c8102e]">
            {error}
          </span>
        ) : saved ? (
          <span className="font-semibold text-green-700">Saved.</span>
        ) : count >= max && available === 0 && held === count ? (
          <>You have every wish list {organisation} has to give this year.</>
        ) : count >= max ? (
          <>That&rsquo;s all {organisation} has left this year.</>
        ) : held > 0 && count <= held ? (
          <>
            You&rsquo;re holding {held} wish {held === 1 ? 'list' : 'lists'}. To take on fewer,
            give one back below.
          </>
        ) : (
          <>Change this any time. It&rsquo;s better to tell us early than to go quiet.</>
        )}
      </p>
    </div>
  )
}
