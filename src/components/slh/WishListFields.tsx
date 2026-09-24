'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { INTERESTS, SIZE_BANDS, WISH_KINDS } from '@/lib/slh-wishlist'

/**
 * The wish list questions themselves.
 *
 * One definition, used both when nominating a child and when editing their
 * list afterwards — the questions cannot drift apart, and somebody who fills
 * half of it in at nomination finds the same fields waiting later.
 *
 * Controlled and presentational: no saving, no actions, no knowledge of which
 * screen it is on. The order is the mockup's and it is deliberate — interests
 * and the child's own words come *before* the four gifts, because they are
 * what turn a list of items into a person to shop for.
 */
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

export const EMPTY_WISH_LIST: WishListValues = {
  favouriteColour: '',
  clothesBand: '',
  clothesSize: '',
  shoesBand: '',
  shoesSize: '',
  interests: [],
  wishWant: '',
  wishNeed: '',
  wishWear: '',
  wishRead: '',
  storyText: '',
}

const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'
const label = 'block text-[13px] font-bold'

function Bands({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {SIZE_BANDS.map(([band, name, hint]) => (
        <button
          key={band}
          type="button"
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

export function WishListFields({
  idPrefix,
  value: v,
  onChange,
  childName,
  storyNote,
}: {
  /** Unique per child, so labels and inputs stay paired when there are siblings. */
  idPrefix: string
  value: WishListValues
  onChange: (patch: Partial<WishListValues>) => void
  childName?: string
  storyNote?: string
}) {
  const [custom, setCustom] = useState('')

  const toggleInterest = (name: string) =>
    onChange({
      interests: v.interests.includes(name)
        ? v.interests.filter((i) => i !== name)
        : [...v.interests, name],
    })

  /** Anything the chip list never thought of. Deduped on the server too. */
  function addCustom() {
    const name = custom.trim()
    if (!name) return
    if (!v.interests.some((i) => i.toLowerCase() === name.toLowerCase())) {
      onChange({ interests: [...v.interests, name] })
    }
    setCustom('')
  }

  const extras = v.interests.filter(
    (i) => !INTERESTS.some((preset) => preset.toLowerCase() === i.toLowerCase()),
  )

  return (
    <div className="grid gap-7">
      <div>
        <span className="text-base font-extrabold tracking-tight">What are they into?</span>
        <p className="mt-0.5 text-sm text-neutral-500">
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
        <label className={label} htmlFor={`${idPrefix}-colour`}>
          Favourite colour
        </label>
        <input
          id={`${idPrefix}-colour`}
          value={v.favouriteColour}
          onChange={(e) => onChange({ favouriteColour: e.target.value })}
          className={`${field} mt-1.5`}
          placeholder="Favourite colour"
        />
      </div>

      <div>
        <span className={label}>Clothing size</span>
        <Bands value={v.clothesBand} onChange={(b) => onChange({ clothesBand: b })} />
        <input
          value={v.clothesSize}
          onChange={(e) => onChange({ clothesSize: e.target.value })}
          aria-label="Clothing size within that band"
          className={`${field} mt-2.5`}
          placeholder="Clothing size"
        />
      </div>

      <div>
        <span className={label}>Shoe size</span>
        <Bands value={v.shoesBand} onChange={(b) => onChange({ shoesBand: b })} />
        <input
          value={v.shoesSize}
          onChange={(e) => onChange({ shoesSize: e.target.value })}
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

      {WISH_KINDS.map(([key, title, hint]) => {
        const prop = `wish${key[0].toUpperCase()}${key.slice(1)}` as keyof WishListValues
        return (
          <div key={key}>
            <label
              className="block text-base font-extrabold tracking-tight"
              htmlFor={`${idPrefix}-${key}`}
            >
              {title}
            </label>
            <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>
            <input
              id={`${idPrefix}-${key}`}
              value={v[prop] as string}
              onChange={(e) => onChange({ [prop]: e.target.value } as Partial<WishListValues>)}
              className={`${field} mt-2`}
            />
          </div>
        )
      })}

      <hr className="border-neutral-100" />

      <div>
        <label
          className="block text-base font-extrabold tracking-tight"
          htmlFor={`${idPrefix}-story`}
        >
          In their own words
        </label>
        <p className="mt-0.5 text-sm text-neutral-500">
          Anything {childName?.trim() || 'they'} want{childName?.trim() ? 's' : ''} whoever is
          shopping to know. A few sentences is plenty.
        </p>
        <textarea
          id={`${idPrefix}-story`}
          rows={4}
          value={v.storyText}
          onChange={(e) => onChange({ storyText: e.target.value })}
          className={`${field} mt-2 resize-y`}
        />
        <p className="mt-1.5 text-xs text-neutral-400">
          {storyNote ?? 'Somebody at Lighthouse reads this before any shopper sees it.'}
        </p>
      </div>
    </div>
  )
}
