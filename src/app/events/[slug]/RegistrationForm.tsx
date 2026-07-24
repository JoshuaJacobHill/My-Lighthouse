'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { registerForEventAction } from '@/lib/actions/ticket.actions'

export interface TicketTypeOption {
  id: string
  name: string
  price: number
  remaining: number | null
  max: number
}

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export function RegistrationForm({
  eventId,
  ticketTypes,
}: {
  eventId: string
  ticketTypes: TicketTypeOption[]
}) {
  const router = useRouter()
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function setQuantity(id: string, next: number, max: number) {
    const clamped = Math.max(0, Math.min(next, max))
    setQty((prev) => ({ ...prev, [id]: clamped }))
  }

  const total = ticketTypes.reduce((sum, t) => sum + t.price * (qty[t.id] ?? 0), 0)
  const count = ticketTypes.reduce((sum, t) => sum + (qty[t.id] ?? 0), 0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const result = await registerForEventAction({
      eventId,
      purchaserName: (fd.get('name') as string) ?? '',
      purchaserEmail: (fd.get('email') as string) ?? '',
      selections: ticketTypes.map((t) => ({ ticketTypeId: t.id, quantity: qty[t.id] ?? 0 })),
    })

    if (result.success && result.url) {
      window.location.href = result.url // paid → Stripe
      return
    }
    if (result.success && result.redirectTo) {
      router.push(result.redirectTo) // free → confirmation
      return
    }
    setLoading(false)
    setError(result.error ?? 'Something went wrong. Please try again.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900">Choose your tickets</h2>
        <div className="mt-3 divide-y divide-gray-100">
          {ticketTypes.map((t) => {
            const q = qty[t.id] ?? 0
            const soldOut = t.max === 0
            return (
              <div key={t.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">
                    {t.price === 0 ? 'Free' : aud.format(t.price)}
                    {t.remaining != null && !soldOut && (
                      <span className="ml-2 text-xs text-gray-400">{t.remaining} left</span>
                    )}
                    {soldOut && <span className="ml-2 text-xs font-medium text-red-500">Sold out</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(t.id, q - 1, t.max)}
                    disabled={q === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                    aria-label={`Fewer ${t.name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center tabular-nums font-medium text-gray-900" aria-live="polite">{q}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(t.id, q + 1, t.max)}
                    disabled={q >= t.max}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                    aria-label={`More ${t.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-5">
        <Input label="Your name" name="name" required autoComplete="name" />
        <Input label="Email address" name="email" type="email" required autoComplete="email" hint="We’ll email your tickets here." />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading || count === 0}>
        {loading
          ? 'Just a moment…'
          : count === 0
            ? 'Select tickets to continue'
            : total === 0
              ? `Register (${count} ${count === 1 ? 'ticket' : 'tickets'})`
              : `Pay ${aud.format(total)} · ${count} ${count === 1 ? 'ticket' : 'tickets'}`}
      </Button>
    </form>
  )
}
