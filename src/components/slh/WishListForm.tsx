'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { saveWishListAction } from '@/lib/actions/slh.actions'
import { INTERESTS, SIZE_BANDS, WISH_KINDS } from '@/lib/slh-wishlist'

/**
 * A child's wish list, as the organisation fills it in.
 *
 * The order is the mockup's and it is deliberate: interests and the child's
 * own words come **before** the four gifts, because they are what turn a list
 * of items into a person to shop for. Somebody who knows a child is into BMX
 * and Spider-Man buys better than somebody reading "something they want".
 */
const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'
const label = 'block text-[13px] font-bold'

export type WishListValues = {
  favouriteColour: string
  clothesBand: string
  clothesSize: string
  shoesBand: string
  shoesSize: string
  interests: string[]
  wishWant: string
  wishNeed: string
  wishWear: string
  wishRead: string
  storyText: string
}

function Bands({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {SIZE_BANDS.map(([band, name, hint]) => (
        <button
          key={band}
          type="button"
          id={`${id}-${band}`}
          onClick={() => onChange(value === band ? '' : band)}
          aria-pressed={value === band}
          title={hint}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
            value === band
              ? 'bg-neutral-900 text-white'
              : 'border border-neutral-300 hover:bg-neutral-50'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

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
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const set = (patch: Partial<WishListValues>) => {
    setV((old) => ({ ...old, ...patch }))
    setSaved(false)
  }

  const toggleInterest = (name: string) =>
    set({
      interests: v.interests.includes(name)
        ? v.interests.filter((i) => i !== name)
        : [...v.interests, name],
    })

  /** Anything the chip list never thought of. Deduped on the server too. */
  function addCustom() {
    const name = custom.trim()
    if (!name) return
    if (!v.interests.some((i) => i.toLowerCase() === name.toLowerCase())) {
      set({ interests: [...v.interests, name] })
    }
    setCustom('')
  }

  const extras = v.interests.filter(
    (i) => !INTERESTS.some((preset) => preset.toLowerCase() === i.toLowerCase()),
  )

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
      <div className="mt-7 grid gap-7">
        <div>
          <span className="text-lg font-bold tracking-tight">What are they into?</span>
          <p className="mt-1 text-sm text-neutral-500">
            Tap as many as you like. This is what a shopper reads first.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTERESTS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleInterest(name)}
                aria-pressed={v.interests.includes(name)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  v.interests.includes(name)
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {extras.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {extras.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#c8102e] py-1.5 pl-3.5 pr-2 text-[13px] font-semibold text-white"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => toggleInterest(name)}
                    aria-label={`Remove ${name}`}
                    className="opacity-70 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
              placeholder="Something else they love"
              aria-label="Add another interest"
              className={field}
            />
            <button
              type="button"
              onClick={addCustom}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-300 px-4 text-[13px] font-bold hover:bg-neutral-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
            </button>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="favouriteColour">
            Favourite colour
          </label>
          <input
            id="favouriteColour"
            value={v.favouriteColour}
            onChange={(e) => set({ favouriteColour: e.target.value })}
            className={`${field} mt-1.5`}
            placeholder="Favourite colour"
          />
        </div>

        <div>
          <span className={label}>Clothing size</span>
          <Bands id="clothes" value={v.clothesBand} onChange={(b) => set({ clothesBand: b })} />
          <input
            value={v.clothesSize}
            onChange={(e) => set({ clothesSize: e.target.value })}
            aria-label="Clothing size within that band"
            className={`${field} mt-2.5`}
            placeholder="Clothing size"
          />
        </div>

        <div>
          <span className={label}>Shoe size</span>
          <Bands id="shoes" value={v.shoesBand} onChange={(b) => set({ shoesBand: b })} />
          <input
            value={v.shoesSize}
            onChange={(e) => set({ shoesSize: e.target.value })}
            aria-label="Shoe size within that band"
            className={`${field} mt-2.5`}
            placeholder="Shoe size"
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            &ldquo;Size 4&rdquo; on its own means nothing in a shop — the band is what makes it
            usable.
          </p>
        </div>

        <hr className="border-neutral-100" />

        {WISH_KINDS.map(([key, title, hint]) => (
          <div key={key}>
            <label className="block text-base font-extrabold tracking-tight" htmlFor={key}>
              {title}
            </label>
            <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>
            <input
              id={key}
              value={v[`wish${key[0].toUpperCase()}${key.slice(1)}` as keyof WishListValues] as string}
              onChange={(e) =>
                set({
                  [`wish${key[0].toUpperCase()}${key.slice(1)}`]: e.target.value,
                } as Partial<WishListValues>)
              }
              className={`${field} mt-2`}
            />
          </div>
        ))}

        <hr className="border-neutral-100" />

        <div>
          <label className="block text-base font-extrabold tracking-tight" htmlFor="storyText">
            In their own words
          </label>
          <p className="mt-0.5 text-sm text-neutral-500">
            Anything {childName} wants whoever is shopping to know. A few sentences is plenty.
          </p>
          <textarea
            id="storyText"
            rows={4}
            value={v.storyText}
            onChange={(e) => set({ storyText: e.target.value })}
            className={`${field} mt-2 resize-y`}
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            {storyApproved && v.storyText === initial.storyText
              ? 'Approved — shoppers can read this.'
              : v.storyText.trim()
                ? 'Somebody at Lighthouse reads this before any shopper sees it. Editing it sends it back for checking.'
                : 'Somebody at Lighthouse reads this before any shopper sees it.'}
          </p>
        </div>
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
