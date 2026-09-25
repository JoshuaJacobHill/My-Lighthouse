'use client'

import { useState, useTransition } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { saveFamilyWishListAction } from '@/lib/actions/slh.actions'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { SantaMark } from '@/components/slh/SantaMark'
import { Dots, Takeover, WhiteButton } from '@/components/slh/Takeover'
import { bannedMessage, bannedTermIn } from '@/lib/wishlist-limits'
import {
  GARMENTS,
  INTERESTS,
  SIZE_BANDS,
  SWATCHES,
  WISH_KINDS,
  wishListReady,
} from '@/lib/slh-wishlist'
import type { WishListValues } from '@/components/slh/WishListFields'

/**
 * A child writing their wish list to Santa.
 *
 * The same takeover the shopper's sign-up uses — solid colour, snow, white
 * type — because this is the more important of the two. A child filling in a
 * form on their mum's phone should get something that feels like Christmas,
 * not a data-entry screen with their name at the top.
 *
 * Four short screens per child rather than one long form: a nine-year-old
 * abandons a page of twelve fields, and answers all twelve when they arrive
 * three at a time. Saved at the end of each child, so a family with three of
 * them can do one tonight and the rest tomorrow.
 */
const field =
  'w-full rounded-2xl border-0 bg-white/15 px-4 py-3.5 text-base text-white placeholder:text-white/50 focus:bg-white/20 focus:outline-none'

export type FamilyChild = {
  id: string
  firstName: string
  dateOfBirth: string
  gender: string
  values: WishListValues
}

type Screen = 'list' | 'hello' | 'about' | 'wishes' | 'words' | 'thanks'

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
        on ? 'bg-white text-neutral-900' : 'border border-white/40 text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

export function FamilyWishLists({
  token,
  // Not `children`: that is React's own prop, and shadowing it makes every
  // nested component in this file quietly wrong.
  childRows,
  bannedTerms,
  organisation,
}: {
  token: string
  childRows: FamilyChild[]
  bannedTerms: string[]
  organisation: string
}) {
  const [screen, setScreen] = useState<Screen>('list')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[]>(
    childRows.filter((c) => wishListReady(c.values)).map((c) => c.id),
  )
  const [name, setName] = useState('')
  const [v, setV] = useState<WishListValues | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const child = childRows.find((c) => c.id === activeId) ?? null
  const set = (patch: Partial<WishListValues>) => setV((old) => (old ? { ...old, ...patch } : old))

  function open(c: FamilyChild) {
    setActiveId(c.id)
    setName(c.firstName)
    setV(c.values)
    setError(null)
    setScreen('hello')
  }

  function save() {
    if (!child || !v) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('token', token)
      fd.set('childId', child.id)
      fd.set('firstName', name)
      fd.set('dateOfBirth', child.dateOfBirth)
      fd.set('gender', child.gender)
      fd.set('interests', JSON.stringify(v.interests))
      for (const key of [
        'favouriteColour',
        'clothesBand',
        'topSize',
        'bottomSize',
        'dressSize',
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

      const result = await saveFamilyWishListAction(fd)
      if (result.success) {
        setSaved((s) => [...new Set([...s, child.id])])
        setScreen('thanks')
      } else {
        setError(result.error ?? 'Could not save that. Please try again.')
      }
    })
  }

  /* ── Who is filling one in ─────────────────────────────────────────────── */
  if (screen === 'list' || !child || !v) {
    const left = childRows.filter((c) => !saved.includes(c.id))
    return (
      <Takeover tone="red" music>
        <div className="grid justify-items-center gap-2 text-center">
          <SantaMark className="h-14 w-14" />
          <p className="text-[11px] font-bold tracking-[0.22em] text-white/80">
            SANTA&rsquo;S LITTLE HELPERS
          </p>
        </div>

        <div className="flex-1" />

        <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight">
          Merry Christmas!
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/85">
          {organisation} has put your family forward. Somebody in the community is going to shop
          for {childRows.length === 1 ? 'your child' : 'each of your children'} — telling them what
          they&rsquo;d love means the presents are chosen just for them.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-white/85">
          {left.length === 0
            ? 'Every list is done. You can change them any time.'
            : `There ${left.length === 1 ? 'is one list' : `are ${left.length} lists`} to write. It takes a couple of minutes each.`}
        </p>

        <div className="mt-6 grid gap-3">
          {childRows.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => open(c)}
              className={`flex items-center gap-3.5 rounded-[22px] p-4 text-left transition-colors ${
                saved.includes(c.id) ? 'bg-white/10' : 'bg-white text-neutral-900'
              }`}
            >
              <ChildAvatar
                gender={c.gender === 'girl' ? 'girl' : 'boy'}
                className="h-12 w-12 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold leading-tight">
                  {c.firstName || `Child ${i + 1}`}
                </span>
                <span
                  className={`block text-[13px] ${saved.includes(c.id) ? 'text-white/70' : 'text-neutral-500'}`}
                >
                  {saved.includes(c.id) ? 'Done — tap to change' : 'Tap to write their list'}
                </span>
              </span>
              {saved.includes(c.id) ? (
                <Check className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <p className="mt-8 text-[13px] leading-relaxed text-white/70">
          Whoever shops sees a first name, an age and the list. They never see your name, your
          address or how to reach you.
        </p>
      </Takeover>
    )
  }

  const who = name.trim() || 'there'

  /* ── Hello ─────────────────────────────────────────────────────────────── */
  if (screen === 'hello') {
    return (
      <Takeover tone="red" music>
        <Dots step={1} of={4} />
        <div className="flex-1" />
        <SantaMark className="h-16 w-16" />
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight">
          Hi {who},
          <br />
          Merry Christmas!
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/85">
          Write your wish list to Santa. There are no wrong answers — somebody is going shopping
          just for you.
        </p>
        <div className="mt-6">
          <label className="block text-[13px] font-bold text-white/80" htmlFor="child-name">
            What should we call you?
          </label>
          <input
            id="child-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className={`${field} mt-2`}
          />
        </div>
        <div className="flex-1" />
        <div className="mt-8 grid gap-2.5">
          <WhiteButton onClick={() => setScreen('about')}>Let&rsquo;s go</WhiteButton>
          <button
            type="button"
            onClick={() => setScreen('list')}
            className="py-1 text-[13px] font-semibold text-white/70 hover:text-white"
          >
            Back
          </button>
        </div>
      </Takeover>
    )
  }

  /* ── About you ─────────────────────────────────────────────────────────── */
  if (screen === 'about') {
    const extras = v.interests.filter(
      (i) => !INTERESTS.some((preset) => preset.toLowerCase() === i.toLowerCase()),
    )
    return (
      <Takeover tone="green" music>
        <Dots step={2} of={4} />
        <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
          Tell us about you
        </h2>

        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">
          What is your favourite colour?
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {SWATCHES.map(([hex, colour]) => {
            const on = v.favouriteColour.trim().toLowerCase() === colour.toLowerCase()
            return (
              <button
                key={colour}
                type="button"
                onClick={() => set({ favouriteColour: on ? '' : colour })}
                aria-pressed={on}
                aria-label={colour}
                className={`h-11 w-11 rounded-xl border-[3px] ${on ? 'border-white' : 'border-transparent'}`}
                style={{ background: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)' }}
              />
            )
          })}
        </div>

        <p className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">
          What are you into? Tap as many as you like
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <Chip
              key={interest}
              on={v.interests.includes(interest)}
              onClick={() =>
                set({
                  interests: v.interests.includes(interest)
                    ? v.interests.filter((i) => i !== interest)
                    : [...v.interests, interest],
                })
              }
            >
              {interest}
            </Chip>
          ))}
          {extras.map((interest) => (
            <Chip
              key={interest}
              on
              onClick={() => set({ interests: v.interests.filter((i) => i !== interest) })}
            >
              {interest}
            </Chip>
          ))}
        </div>

        <p className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">
          What sizes are you?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SIZE_BANDS.map(([band, label]) => (
            <Chip
              key={band}
              on={v.clothesBand === band}
              onClick={() => set({ clothesBand: v.clothesBand === band ? '' : band })}
            >
              {label}
            </Chip>
          ))}
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {GARMENTS.map(([key, label]) => (
            <input
              key={key}
              value={v[key]}
              onChange={(e) => set({ [key]: e.target.value } as Partial<WishListValues>)}
              placeholder={label}
              aria-label={label}
              className={field}
            />
          ))}
        </div>
        <input
          value={v.shoesSize}
          onChange={(e) => set({ shoesSize: e.target.value })}
          placeholder="Shoe size"
          aria-label="Shoe size"
          className={`${field} mt-2.5`}
        />

        <div className="flex-1" />
        <div className="mt-8 grid gap-2.5">
          <WhiteButton onClick={() => setScreen('wishes')}>Next</WhiteButton>
          <button
            type="button"
            onClick={() => setScreen('hello')}
            className="py-1 text-[13px] font-semibold text-white/70 hover:text-white"
          >
            Back
          </button>
        </div>
      </Takeover>
    )
  }

  /* ── The four wishes ───────────────────────────────────────────────────── */
  if (screen === 'wishes') {
    const problems = WISH_KINDS.map(([key]) => {
      const prop = `wish${key[0].toUpperCase()}${key.slice(1)}` as keyof WishListValues
      return bannedTermIn(String(v[prop] ?? ''), bannedTerms)
    })

    return (
      <Takeover tone="red" music>
        <Dots step={3} of={4} />
        <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
          What would you love?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">
          Four things. Be as specific as you like — it helps whoever is shopping.
        </p>

        <div className="mt-6 grid gap-5">
          {WISH_KINDS.map(([key, title, hint], i) => {
            const prop = `wish${key[0].toUpperCase()}${key.slice(1)}` as keyof WishListValues
            return (
              <div key={key}>
                <label className="block text-base font-extrabold" htmlFor={`w-${key}`}>
                  {title}
                </label>
                <p className="mt-0.5 text-[13px] text-white/70">{hint}</p>
                <input
                  id={`w-${key}`}
                  value={v[prop] as string}
                  onChange={(e) => set({ [prop]: e.target.value } as Partial<WishListValues>)}
                  className={`${field} mt-2`}
                />
                {problems[i] && (
                  <p role="status" className="mt-2 text-[13px] font-semibold text-white">
                    {bannedMessage(problems[i]!)}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex-1" />
        <div className="mt-8 grid gap-2.5">
          <WhiteButton
            disabled={problems.some(Boolean)}
            onClick={() => setScreen('words')}
          >
            Next
          </WhiteButton>
          <button
            type="button"
            onClick={() => setScreen('about')}
            className="py-1 text-[13px] font-semibold text-white/70 hover:text-white"
          >
            Back
          </button>
        </div>
      </Takeover>
    )
  }

  /* ── Their own words ───────────────────────────────────────────────────── */
  if (screen === 'words') {
    return (
      <Takeover tone="green" music>
        <Dots step={4} of={4} />
        <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
          Anything else you&rsquo;d like to say?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">
          Whatever you want the person shopping for you to know. A few sentences is plenty, and you
          can skip this if you&rsquo;d rather.
        </p>
        <textarea
          rows={6}
          value={v.storyText}
          onChange={(e) => set({ storyText: e.target.value })}
          aria-label="Anything else you would like to say"
          className={`${field} mt-5 resize-y`}
        />
        <p className="mt-2 text-[13px] text-white/70">
          Somebody at Lighthouse reads this first.
        </p>

        <div className="flex-1" />
        <div className="mt-8 grid gap-2.5">
          <WhiteButton disabled={pending} onClick={save}>
            {pending ? 'Sending…' : 'Send my list to Santa'}
          </WhiteButton>
          {error && (
            <p role="alert" className="text-center text-[13px] font-semibold text-white">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => setScreen('wishes')}
            className="py-1 text-[13px] font-semibold text-white/70 hover:text-white"
          >
            Back
          </button>
        </div>
      </Takeover>
    )
  }

  /* ── Thank you ─────────────────────────────────────────────────────────── */
  const left = childRows.filter((c) => !saved.includes(c.id))
  return (
    <Takeover tone="green" music>
      <div className="flex-1" />
      <div className="grid justify-items-center gap-5 text-center">
        <span className="grid h-24 w-24 place-items-center rounded-full bg-white/15">
          <SantaMark className="h-14 w-14" />
        </span>
        <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
          Thank you, {who}!
        </h2>
        <p className="text-[15px] leading-relaxed text-white/85">
          Your list is on its way. Somebody will be shopping for you soon.
        </p>
      </div>
      <div className="flex-1" />
      <div className="mt-8">
        <WhiteButton onClick={() => setScreen('list')}>
          {left.length > 0
            ? `Write ${left.length === 1 ? 'the last list' : `${left.length} more lists`}`
            : 'All done'}
        </WhiteButton>
      </div>
    </Takeover>
  )
}
