'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, X, MessageCircle } from 'lucide-react'
import { postCheerAction, deleteCheerAction } from '@/lib/actions/fitness.actions'
import type { Cheer } from '@/lib/fitness-data'
import { LIME } from '@/lib/fitness-milestones'

const MAX = 280

/**
 * Notes from the team, cleared every night.
 *
 * The prompt does the work here. "Leave a message" gets you nothing; naming
 * what the space is for gets you encouragement.
 */
export function CheerWall({ challengeId, cheers }: { challengeId: string; cheers: Cheer[] }) {
  const router = useRouter()
  const [body, setBody] = React.useState('')
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  function post(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const res = await postCheerAction({ challengeId, body })
      if (!res.success) return setError(res.error ?? 'Could not post that.')
      setBody('')
      router.refresh()
    })
  }

  function remove(id: string) {
    setError('')
    startTransition(async () => {
      const res = await deleteCheerAction(id)
      if (!res.success) return setError(res.error ?? 'Could not remove that.')
      router.refresh()
    })
  }

  const left = MAX - body.length

  return (
    <section className="rounded-[28px] border border-neutral-200 p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-neutral-950">Today&rsquo;s notes</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Cheer someone on, share a tip, or say where you walked. Everything here clears overnight.
      </p>

      <form onSubmit={post} className="mt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX))}
          rows={2}
          placeholder="Nice work on the early start, Bec. Anyone up for a lap at lunch?"
          className="w-full resize-none rounded-2xl border border-neutral-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className={`text-xs ${left < 30 ? 'text-orange-600' : 'text-neutral-400'}`}>
            {left} left
          </span>
          <button
            type="submit"
            disabled={pending || body.trim().length < 2}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Post
          </button>
        </div>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {cheers.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-6 text-center">
          <MessageCircle className="mx-auto h-5 w-5 text-neutral-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-neutral-500">Nothing yet today. Go on, start it off.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {cheers.map((c) => (
            <li
              key={c.id}
              className="group flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{ backgroundColor: c.mine ? LIME : '#f5f5f4' }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-900">{c.body}</p>
                <p className="mt-1 text-xs text-neutral-900/50">
                  {c.name} &middot; {c.at}
                </p>
              </div>
              {c.mine && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  aria-label="Remove your note"
                  className="shrink-0 rounded-full p-1 text-neutral-900/40 hover:bg-black/10 hover:text-neutral-900"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
