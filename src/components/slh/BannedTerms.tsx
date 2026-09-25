'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setBannedTermsAction } from '@/lib/actions/slh.actions'

/**
 * Things a wish list cannot ask for.
 *
 * Not censorship, and worth the screen saying so: every list is shopped by
 * somebody spending around $200 of their own money, and a request for a games
 * console puts them in an impossible position in December. Catching it as a
 * child types means the family gets asked again while there is still time.
 *
 * This box holds **additions only**. The built-in list stays whatever is here,
 * so an empty box cannot quietly un-ban a PlayStation.
 */
export function BannedTerms({
  extra,
  builtInCount,
}: {
  extra: string[]
  builtInCount: number
}) {
  const router = useRouter()
  const [terms, setTerms] = useState(extra.join('\n'))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('terms', terms)
      const result = await setBannedTermsAction(fd)
      if (result.success) {
        setSaved(true)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save that list.')
      }
    })
  }

  return (
    <div className="mt-8 rounded-[28px] border border-neutral-200 p-5">
      <h2 className="text-lg font-bold tracking-tight">Things we can&rsquo;t promise</h2>
      <p className="mt-1 text-sm text-neutral-500">
        A child asking for a games console leaves a shopper choosing between spending far more
        than we asked and handing a list back. These are caught as the list is filled in, so the
        family can be asked again while there is still time.
      </p>

      <label className="mt-4 block text-[13px] font-bold" htmlFor="bannedTerms">
        Add your own — one per line
      </label>
      <textarea
        id="bannedTerms"
        rows={6}
        value={terms}
        onChange={(e) => {
          setTerms(e.target.value)
          setSaved(false)
        }}
        placeholder={'labubu\nlego death star\nelectric guitar'}
        className="mt-1.5 w-full rounded-2xl border border-neutral-200 px-4 py-3 font-mono text-sm focus:border-neutral-400 focus:outline-none"
      />
      <p className="mt-1.5 text-xs text-neutral-400">
        {builtInCount} are built in already — consoles, tablets, phones, drones, live animals.
        Anything here is added to those, so clearing this box cannot switch them off.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save list'}
        </button>
        {error ? (
          <span role="alert" className="text-[13px] font-semibold text-[#c8102e]">
            {error}
          </span>
        ) : saved ? (
          <span className="text-[13px] font-semibold text-green-700">Saved.</span>
        ) : null}
      </div>
    </div>
  )
}
