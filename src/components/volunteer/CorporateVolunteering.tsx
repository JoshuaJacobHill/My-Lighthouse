'use client'

import * as React from 'react'
import { Building2, CalendarDays, Plus, Check } from 'lucide-react'
import { addCorporateSessionAction, requestCorporateDayAction } from '@/lib/actions/corporate.actions'

export interface CorporateSessionView {
  id: string
  date: string | null // ISO
  timeLabel: string | null
  teamSize: string | null
  source: string | null
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
    : 'Date to be confirmed'

const inputCls =
  'w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

export function CorporateVolunteering({
  companyName,
  sessions,
}: {
  companyName: string
  sessions: CorporateSessionView[]
}) {
  const [booking, setBooking] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [booked, setBooked] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function submitBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await requestCorporateDayAction({
        preferredDate: (fd.get('preferredDate') as string) ?? '',
        preferredTime: (fd.get('preferredTime') as string) ?? '',
        teamSize: (fd.get('teamSize') as string) ?? '',
        message: (fd.get('message') as string) ?? '',
      })
      if (!res.success) return setError(res.error ?? 'Something went wrong.')
      setBooked(true)
      setBooking(false)
    })
  }

  function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await addCorporateSessionAction({
        date: (fd.get('date') as string) ?? '',
        timeLabel: (fd.get('timeLabel') as string) ?? '',
        teamSize: (fd.get('teamSize') as string) ?? '',
        notes: (fd.get('notes') as string) ?? '',
      })
      if (!res.success) return setError(res.error ?? 'Something went wrong.')
      setAdding(false)
    })
  }

  return (
    <section className="rounded-[28px] border border-neutral-200 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Corporate volunteering — {companyName}</h2>
          <p className="text-sm text-neutral-500">Your team’s volunteering history with Lighthouse Care.</p>
        </div>
      </div>

      {/* History */}
      <div className="mt-6">
        {sessions.length > 0 ? (
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-900">
                  <CalendarDays className="h-4 w-4 text-orange-500" /> {fmtDate(s.date)}
                </span>
                {s.timeLabel && <span className="text-neutral-600">{s.timeLabel}</span>}
                {s.teamSize && <span className="text-neutral-500">· team of {s.teamSize}</span>}
                {s.source && <span className="ml-auto text-xs text-neutral-400">{s.source}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center">
            <p className="text-sm font-medium text-neutral-600">No volunteer history yet.</p>
            <p className="mt-1 text-sm text-neutral-400">
              Bring your team along for a corporate volunteer day, or add a past session we’ve missed.
            </p>
          </div>
        )}
      </div>

      {booked && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <Check className="h-4 w-4" /> Thanks! We’ve got your request and will be in touch to confirm.
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { setBooking((v) => !v); setAdding(false); setBooked(false) }}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800"
        >
          Book a corporate volunteer day
        </button>
        <button
          type="button"
          onClick={() => { setAdding((v) => !v); setBooking(false) }}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:border-orange-400"
        >
          <Plus className="h-4 w-4" /> Add a past session
        </button>
      </div>

      {/* Booking form */}
      {booking && (
        <form onSubmit={submitBooking} className="mt-5 space-y-3 rounded-2xl bg-neutral-50 p-5">
          <p className="text-sm font-semibold text-neutral-900">Request a date — we’ll confirm or suggest an alternative</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-neutral-600">Preferred date
              <input type="date" name="preferredDate" className={`mt-1 ${inputCls}`} />
            </label>
            <label className="text-xs font-medium text-neutral-600">Preferred time
              <input name="preferredTime" placeholder="e.g. 9:30am–12:30pm" className={`mt-1 ${inputCls}`} />
            </label>
            <label className="text-xs font-medium text-neutral-600">Team size
              <input name="teamSize" placeholder="e.g. 10" className={`mt-1 ${inputCls}`} />
            </label>
          </div>
          <textarea name="message" rows={3} placeholder="Anything else we should know? (optional)" className={inputCls} />
          <button type="submit" disabled={pending} className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
            {pending ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}

      {/* Manual add form */}
      {adding && (
        <form onSubmit={submitAdd} className="mt-5 space-y-3 rounded-2xl bg-neutral-50 p-5">
          <p className="text-sm font-semibold text-neutral-900">Add a past volunteering session</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-neutral-600">Date
              <input type="date" name="date" className={`mt-1 ${inputCls}`} />
            </label>
            <label className="text-xs font-medium text-neutral-600">Time
              <input name="timeLabel" placeholder="e.g. 9:30am–12:30pm" className={`mt-1 ${inputCls}`} />
            </label>
            <label className="text-xs font-medium text-neutral-600">Team size
              <input name="teamSize" placeholder="e.g. 8" className={`mt-1 ${inputCls}`} />
            </label>
          </div>
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className={inputCls} />
          <button type="submit" disabled={pending} className="rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-50">
            {pending ? 'Saving…' : 'Add session'}
          </button>
        </form>
      )}
    </section>
  )
}
