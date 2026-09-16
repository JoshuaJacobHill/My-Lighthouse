'use client'

import * as React from 'react'
import { Loader2, Plus } from 'lucide-react'
import { proposeFundraiserAction } from '@/lib/actions/organisation.actions'

const field =
  'w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500'

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

export type OwnFundraiser = {
  id: string
  title: string
  slug: string
  isActive: boolean
  raisedCents: number
  goalCents: number | null
}

/**
 * A company admin starts a fundraiser of their own.
 *
 * What they write is the appeal — the title, the story, what they are aiming
 * for. What they do not choose is where the money goes or when it goes live:
 * that is set here before anyone can give to it. Said plainly on the form,
 * because a company that writes an appeal and then waits without knowing why
 * assumes they have been ignored.
 */
export function FundraiserProposal({
  organisationId,
  existing,
}: {
  organisationId: string
  existing: OwnFundraiser[]
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState('')

  const [title, setTitle] = React.useState('')
  const [story, setStory] = React.useState('')
  const [goal, setGoal] = React.useState('')

  return (
    <div className="mt-5 border-t border-neutral-100 pt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Fundraisers</p>

      {existing.length > 0 && (
        <ul className="mt-3 space-y-2">
          {existing.map((f) => (
            <li key={f.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-neutral-900">{f.title}</span>
              {f.isActive ? (
                <>
                  <span className="text-neutral-600">
                    {money(f.raisedCents)}
                    {f.goalCents ? ` of ${money(f.goalCents)}` : ' raised'}
                  </span>
                  <a
                    href={`/fundraisers/${f.slug}`}
                    className="font-semibold text-orange-600 hover:underline"
                  >
                    See it
                  </a>
                </>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  with us for review
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {done ? (
        <p className="mt-3 rounded-2xl bg-lime-50 p-4 leading-relaxed text-lime-900">
          Thanks — we have it. Someone will set it up and come back to you before it goes live.
        </p>
      ) : open ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            startTransition(async () => {
              const res = await proposeFundraiserAction({
                organisationId,
                title,
                story,
                goalAmount: goal ? Number(goal) : null,
              })
              if (res.success) setDone(true)
              else setError(res.error ?? 'Something went wrong.')
            })
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
              What are you calling it?
            </span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
              What is it for?
            </span>
            <textarea
              required
              rows={5}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-neutral-700">
              Aiming for <span className="font-normal text-neutral-400">(optional)</span>
            </span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              placeholder="5000"
              className={field}
            />
          </label>

          <p className="text-sm leading-relaxed text-neutral-500">
            We will set it up, add a photo if you send us one, and let you know before it opens.
            Nothing is visible until then.
          </p>

          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending || !title.trim() || story.trim().length < 40}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Send it to us
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Start a fundraiser
        </button>
      )}
    </div>
  )
}
