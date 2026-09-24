'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy } from 'lucide-react'
import { setDeliveryAction } from '@/lib/actions/slh.actions'
import {
  dayLabel,
  datesBetween,
  formatDay,
  isWeekend,
  parseDays,
  type DropOffDay,
} from '@/lib/slh-dropoff'

/**
 * Where gifts are taken, which days, and the hours on each of them.
 *
 * Three separate facts, and collapsing any two of them tells a shopper
 * something untrue. A window of "1–12 December" is shut both weekends; a
 * Wednesday inside it may be shut for a staff meeting; and "open Thursday"
 * does not mean somebody is there at 8pm. A shopper who drives over with four
 * wrapped presents in the boot and finds a locked door has been let down by
 * whichever of the three nobody recorded.
 *
 * So: the window sets the range, each day is ticked or unticked inside it, and
 * each open day carries its own hours. Hours are optional — plenty of
 * organisations genuinely mean "any time we're open".
 */
const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'
const label = 'block text-[13px] font-bold'
const timeBox =
  'rounded-xl border border-neutral-200 px-2.5 py-1.5 text-[13px] focus:border-neutral-400 focus:outline-none'

export function DeliveryDetails({
  organisationId,
  address: initialAddress,
  opensAt: initialOpens,
  closesAt: initialCloses,
  days: initialDays,
}: {
  organisationId: string
  address: string
  opensAt: string
  closesAt: string
  days: string[]
}) {
  const router = useRouter()
  const [address, setAddress] = useState(initialAddress)
  const [opensAt, setOpensAt] = useState(initialOpens)
  const [closesAt, setClosesAt] = useState(initialCloses)
  const [days, setDays] = useState<DropOffDay[]>(parseDays(initialDays))
  const [touched, setTouched] = useState(initialDays.length > 0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const range = datesBetween(opensAt, closesAt)

  // Nothing chosen yet means "every day in the window" — shown as every day
  // lit, rather than a row of empty chips that reads like a mistake.
  const effective: DropOffDay[] = touched
    ? days
    : range.map((date) => ({ date, from: null, to: null }))

  const dayFor = (date: string) => effective.find((d) => d.date === date) ?? null
  const dirty = () => {
    setSaved(false)
    setError(null)
  }

  function toggle(date: string) {
    dirty()
    setTouched(true)
    const base = touched ? days : effective
    setDays(
      base.some((d) => d.date === date)
        ? base.filter((d) => d.date !== date)
        : [...base, { date, from: null, to: null }].sort((a, b) => a.date.localeCompare(b.date)),
    )
  }

  function setTime(date: string, part: 'from' | 'to', value: string) {
    dirty()
    setTouched(true)
    const base = touched ? days : effective
    setDays(base.map((d) => (d.date === date ? { ...d, [part]: value || null } : d)))
  }

  /** Ten days of identical hours typed ten times is how mistakes get in. */
  function copyFirstTimes() {
    const first = effective.find((d) => d.from && d.to)
    if (!first) return
    dirty()
    setTouched(true)
    setDays(effective.map((d) => ({ ...d, from: first.from, to: first.to })))
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('organisationId', organisationId)
      fd.set('address', address)
      fd.set('opensAt', opensAt)
      fd.set('closesAt', closesAt)
      fd.set('days', JSON.stringify(effective.map(formatDay)))
      const result = await setDeliveryAction(fd)
      if (result.success) {
        setSaved(true)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save the drop-off details.')
      }
    })
  }

  return (
    <div className="mt-8 rounded-[28px] border border-neutral-200 p-5">
      <h2 className="text-lg font-bold tracking-tight">Gift drop-off</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Shoppers read this before they sign up, and count the days down to it.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <label className={label} htmlFor="dropOffAddress">
            Delivery address
          </label>
          <input
            id="dropOffAddress"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              dirty()
            }}
            placeholder="Street, suburb, state and postcode"
            className={`${field} mt-1.5`}
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            Where the gifts go — often not the same as your main address.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="opensAt">
              First day
            </label>
            <input
              id="opensAt"
              type="date"
              value={opensAt}
              onChange={(e) => {
                setOpensAt(e.target.value)
                setDays([])
                setTouched(false)
                dirty()
              }}
              className={`${field} mt-1.5`}
            />
          </div>
          <div>
            <label className={label} htmlFor="closesAt">
              Last day
            </label>
            <input
              id="closesAt"
              type="date"
              value={closesAt}
              onChange={(e) => {
                setClosesAt(e.target.value)
                setDays([])
                setTouched(false)
                dirty()
              }}
              className={`${field} mt-1.5`}
            />
          </div>
        </div>

        {range.length > 0 && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={label}>Which days, and what times?</span>
              {effective.some((d) => d.from && d.to) && (
                <button
                  type="button"
                  onClick={copyFirstTimes}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Use the first day&rsquo;s
                  times for all
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Untick any day nobody will be there — a Wednesday in the middle of the week is fine
              to skip. Leave times blank for &ldquo;any time we&rsquo;re open&rdquo;.
            </p>

            <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200">
              {range.map((date) => {
                const day = dayFor(date)
                const on = day !== null
                return (
                  <div
                    key={date}
                    className={`flex flex-wrap items-center gap-3 px-3.5 py-2.5 ${
                      on ? '' : 'bg-neutral-50/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(date)}
                      aria-pressed={on}
                      className="flex min-w-[8.5rem] items-center gap-2.5 text-left"
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${
                          on
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-300 text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span
                        className={`text-[13px] font-semibold ${
                          on ? '' : isWeekend(date) ? 'text-neutral-300' : 'text-neutral-400'
                        }`}
                      >
                        {dayLabel(date)}
                      </span>
                    </button>

                    {on && (
                      <span className="flex items-center gap-2 text-[13px] text-neutral-400">
                        <input
                          type="time"
                          value={day?.from ?? ''}
                          onChange={(e) => setTime(date, 'from', e.target.value)}
                          aria-label={`Open from on ${dayLabel(date)}`}
                          className={timeBox}
                        />
                        to
                        <input
                          type="time"
                          value={day?.to ?? ''}
                          onChange={(e) => setTime(date, 'to', e.target.value)}
                          aria-label={`Open until on ${dayLabel(date)}`}
                          className={timeBox}
                        />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save drop-off details'}
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
