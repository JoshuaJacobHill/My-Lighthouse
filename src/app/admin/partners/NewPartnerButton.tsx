'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { createOrgAction } from '@/lib/actions/organisation.actions'

/**
 * Add a partner we already have.
 *
 * A company that has sponsored three festivals should not have to apply for a
 * page in order to be recognised for them, so this creates an approved one
 * directly — we are the people who would have approved it.
 */
export function NewPartnerButton() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [website, setWebsite] = React.useState('')
  const [error, setError] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add a partner
      </button>
    )
  }

  return (
    <div className="w-full rounded-[28px] border border-neutral-200 p-5 sm:w-80">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-neutral-700">Company name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-neutral-700">Website (optional)</span>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await createOrgAction({ name, website })
              if (!res.success || !res.id) {
                setError(res.error ?? 'Could not create it.')
                return
              }
              router.push(`/admin/partners/${res.id}`)
            })
          }
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Create
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
