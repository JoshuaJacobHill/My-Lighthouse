'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { GARMENTS, INTERESTS, SIZE_BANDS, SWATCHES, WISH_KINDS } from '@/lib/slh-wishlist'
import { bannedMessage, bannedTermIn } from '@/lib/wishlist-limits'

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
  topSize: string
  bottomSize: string
  dressSize: string
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
  topSize: '',
  bottomSize: '',
  dressSize: '',
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
  bannedTerms = [],
}: {
  /** Unique per child, so labels and inputs stay paired when there are siblings. */
  idPrefix: string
  value: WishListValues
  onChange: (patch: Partial<WishListValues>) => void
  childName?: string
  storyNote?: string
  /** Things we cannot promise. Checked again on save; this is the kind version. */
  bannedTerms?: string[]
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
        <span className={label} id={`${idPrefix}-colour-label`}>
          Favourite colour
        </span>
        <div
          role="group"
          aria-labelledby={`${idPrefix}-colour-label`}
          className="mt-2 flex flex-wrap gap-2.5"
        >
          {SWATCHES.map(([hex, name]) => {
            const on = v.favouriteColour.trim().toLowerCase() === name.toLowerCase()
            return (
              <button
                key={name}
                type="button"
                onClick={() => onChange({ favouriteColour: on ? '' : name })}
                aria-pressed={on}
                aria-label={name}
                title={name}
                className={`h-10 w-10 rounded-xl border-[3px] transition-colors ${
                  on ? 'border-neutral-900' : 'border-transparent'
                }`}
                style={{ background: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.1)' }}
              />
            )
          })}
        </div>
        {/* Children have favourite colours that are not on a palette. */}
        <input
          id={`${idPrefix}-colour`}
          value={v.favouriteColour}
          onChange={(e) => onChange({ favouriteColour: e.target.value })}
          className={`${field} mt-2.5`}
          placeholder="Or type another colour"
          aria-label="Favourite colour, typed"
        />
      </div>

      <div>
        <span className={label}>Clothing sizes</span>
        <Bands value={v.clothesBand} onChange={(b) => onChange({ clothesBand: b })} />
        {/* One number does not dress a child: a ten-year-old can be a size 10
            on top and a size 8 in the leg, and a shopper standing there with a
            t-shirt and a pair of shorts needs both. */}
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          {GARMENTS.map(([key, name]) => (
            <div key={key}>
              <label
                className="mb-1 block text-xs font-semibold text-neutral-500"
                htmlFor={`${idPrefix}-${key}`}
              >
                {name}
              </label>
              <input
                id={`${idPrefix}-${key}`}
                value={v[key]}
                onChange={(e) => onChange({ [key]: e.target.value } as Partial<WishListValues>)}
                className={field}
              />
            </div>
          ))}
        </div>
        <input
          value={v.clothesSize}
          onChange={(e) => onChange({ clothesSize: e.target.value })}
          aria-label="One size for everything"
          className={`${field} mt-2.5`}
          placeholder="Or one size for everything"
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
        // Said while they are still typing, so the answer can be changed in
        // the moment rather than bounced back at them on save.
        const banned = bannedTermIn(String(v[prop] ?? ''), bannedTerms)
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
              aria-invalid={banned ? true : undefined}
              className={`${field} mt-2 ${banned ? 'border-[#c8102e] focus:border-[#c8102e]' : ''}`}
            />
            {banned && (
              <p role="status" className="mt-1.5 text-[13px] font-semibold text-[#c8102e]">
                {bannedMessage(banned)}
              </p>
            )}
          </div>
        )
      })}

      <hr className="border-neutral-100" />

      {/* The child talking to whoever buys their presents. Why the family
          needs help is a different question, asked once per household on the
          nomination form — a shopper has no business reading that one. */}
      <div>
        <label
          className="block text-base font-extrabold tracking-tight"
          htmlFor={`${idPrefix}-story`}
        >
          In {childName?.trim() ? `${childName.trim()}’s` : 'their'} own words
        </label>
        <p className="mt-0.5 text-sm text-neutral-500">
          Anything {childName?.trim() || 'they'} want{childName?.trim() ? 's' : ''} whoever is
          shopping to know — what they love, what they are looking forward to. A few sentences is
          plenty.
        </p>
        <span className="mt-2 inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">
          The shopper reads this
        </span>
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
