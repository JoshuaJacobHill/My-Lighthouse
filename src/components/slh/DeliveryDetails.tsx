'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setDeliveryAction } from '@/lib/actions/slh.actions'

/**
 * Where gifts are taken, and exactly which days somebody is there.
 *
 * The window and the days are two different facts. An organisation taking
 * gifts "1–12 December" is shut both weekends, and a shopper who drives over
 * on the Saturday with four wrapped presents in the boot has been told
 * something untrue. So the window sets the range and the days are ticked
 * inside it — defaulting to every weekday, because that is the common answer.
 */
const field =
  'w-full rounded-2xl border border-neutral-200 px-4 py-3 text-base focus:border-neutral-400 focus:outline-none'
const label = 'block text-[13px] font-bold'

/** Every calendar day between two ISO dates, inclusive. Capped so a typo in a
 *  year cannot try to render a thousand chips. */
function datesBetween(from: string, to: string): string[] {
  if (!from || !to || to < from) return []
  const out: string[] = []
  const cursor = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  while (cursor <= end && out.length < 60) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  return d.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

const isWeekend = (iso: string) => {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

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
  const [days, setDays] = useState<string[]>(initialDays)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const range = datesBetween(opensAt, closesAt)
  // Nothing ticked means "every day in the window" — so show that as every day
  // lit rather than as a row of empty chips that looks like a mistake.
  const on = (iso: string) => days.length === 0 || days.includes(iso)

  function toggle(iso: string) {
    setSaved(false)
    setDays((current) => {
      const base = current.length === 0 ? range : current
      return base.includes(iso) ? base.filter((d) => d !== iso) : [...base, iso].sort()
    })
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('organisationId', organisationId)
      fd.set('address', address)
      fd.set('opensAt', opensAt)
      fd.set('closesAt', closesAt)
      fd.set('days', JSON.stringify(days))
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
              setSaved(false)
            }}
            placeholder="13–15 Monte-Khoury Drive, Loganholme QLD 4129"
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
                setSaved(false)
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
                setSaved(false)
              }}
              className={`${field} mt-1.5`}
            />
          </div>
        </div>

        {range.length > 0 && (
          <div>
            <span className={label}>Which days are you open?</span>
            <p className="mt-1 text-xs text-neutral-400">
              Untick any day nobody will be there. All ticked means every day in the window.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {range.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => toggle(iso)}
                  aria-pressed={on(iso)}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    on(iso)
                      ? 'bg-neutral-900 text-white'
                      : `border border-neutral-300 ${isWeekend(iso) ? 'text-neutral-400' : ''}`
                  }`}
                >
                  {dayLabel(iso)}
                </button>
              ))}
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
