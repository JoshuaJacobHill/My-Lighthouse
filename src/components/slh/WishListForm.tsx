'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveWishListAction } from '@/lib/actions/slh.actions'
import { WishListFields, type WishListValues } from '@/components/slh/WishListFields'

export type { WishListValues }

/**
 * Editing one child's wish list after they have been nominated.
 *
 * The questions live in `WishListFields`, shared with the nomination form, so
 * a list started at nomination and finished here is the same set of fields
 * either way. This is only the saving of them.
 */
export function WishListForm({
  organisationId,
  childId,
  childName,
  initial,
  storyApproved,
}: {
  organisationId: string
  childId: string
  childName: string
  initial: WishListValues
  storyApproved: boolean
}) {
  const router = useRouter()
  const [v, setV] = useState<WishListValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const set = (patch: Partial<WishListValues>) => {
    setV((old) => ({ ...old, ...patch }))
    setSaved(false)
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('organisationId', organisationId)
      fd.set('childId', childId)
      fd.set('interests', JSON.stringify(v.interests))
      for (const key of [
        'favouriteColour',
        'clothesBand',
        'clothesSize',
        'shoesBand',
        'shoesSize',
        'wishWant',
        'wishNeed',
        'wishWear',
        'wishRead',
        'storyText',
      ] as const) {
        fd.set(key, v[key])
      }

      const result = await saveWishListAction(fd)
      if (result.success) {
        setSaved(true)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save that wish list.')
      }
    })
  }

  return (
    <>
      <div className="mt-7">
        <WishListFields
          idPrefix="wish"
          value={v}
          onChange={set}
          childName={childName}
          storyNote={
            storyApproved && v.storyText === initial.storyText
              ? 'Approved — shoppers can read this.'
              : v.storyText.trim()
                ? 'Somebody at Lighthouse reads this before any shopper sees it. Editing it sends it back for checking.'
                : 'Somebody at Lighthouse reads this before any shopper sees it.'
          }
        />
      </div>

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-[#c8102e] py-3.5 text-base font-bold text-white hover:bg-[#9d0b23] disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save wish list'}
        </button>
        {error ? (
          <p role="alert" className="text-center text-[13px] font-semibold text-[#c8102e]">
            {error}
          </p>
        ) : saved ? (
          <p className="text-center text-[13px] font-semibold text-green-700">Saved.</p>
        ) : (
          <p className="text-center text-xs text-neutral-400">
            Save as often as you like — a part-filled list is better than none.
          </p>
        )}
      </div>
    </>
  )
}
