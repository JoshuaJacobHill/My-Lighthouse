'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { HandHeart, Check } from 'lucide-react'
import { signUpEventVolunteerAction } from '@/lib/actions/event-public.actions'

export function EventVolunteerSignup({
  eventId,
  signedUp,
  capacity,
  initialName,
  initialEmail,
}: {
  eventId: string
  signedUp: number
  capacity: number | null
  initialName?: string
  initialEmail?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(initialName ?? '')
  const [email, setEmail] = React.useState(initialEmail ?? '')
  const [phone, setPhone] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  const full = capacity != null && signedUp >= capacity
  const remaining = capacity != null ? Math.max(0, capacity - signedUp) : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await signUpEventVolunteerAction({ eventId, name, email, phone })
      if (!res.success) {
        setError(res.error ?? 'Something went wrong.')
        return
      }
      setDone(true)
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <HandHeart className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Volunteer at this event</h2>
          <p className="text-sm text-gray-500">
            {capacity != null ? `${signedUp} of ${capacity} spots filled` : `${signedUp} signed up so far`}
          </p>
        </div>
      </div>

      {capacity != null && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-orange-500"
            style={{ width: `${Math.min(100, (signedUp / capacity) * 100)}%` }}
          />
        </div>
      )}

      {done ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
          <Check className="h-4 w-4" /> You’re signed up — thank you! We’ll be in touch.
        </p>
      ) : full ? (
        <p className="mt-4 text-sm font-medium text-gray-500">Volunteer spots are full — thank you!</p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Sign up to volunteer{remaining != null ? ` · ${remaining} spots left` : ''}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <input
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {pending ? 'Signing up…' : 'Confirm sign-up'}
          </button>
        </form>
      )}
    </section>
  )
}
