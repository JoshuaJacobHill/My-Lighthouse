'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Check } from 'lucide-react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { stripePromiseFor } from '@/lib/stripe-public'
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
  eventSlug,
  ticketTypes,
  initialName,
  initialEmail,
}: {
  eventId: string
  eventSlug: string
  ticketTypes: TicketTypeOption[]
  /** Set when somebody is signed in — their details, not necessarily the attendee's. */
  initialName?: string
  initialEmail?: string
}) {
  const router = useRouter()
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [name, setName] = React.useState(initialName ?? '')
  const [email, setEmail] = React.useState(initialEmail ?? '')
  // Somebody buying for themselves should not have to retype what we know.
  // Buying for a mate is common enough that it stays one tap away.
  const [editingDetails, setEditingDetails] = React.useState(!initialEmail)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Set only when paying on this page; the hosted flow redirects instead.
  const [payment, setPayment] = React.useState<{
    clientSecret: string
    accountKey: 'CARE' | 'CHURCH'
  } | null>(null)

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

    const result = await registerForEventAction({
      eventId,
      purchaserName: name,
      purchaserEmail: email,
      selections: ticketTypes.map((t) => ({ ticketTypeId: t.id, quantity: qty[t.id] ?? 0 })),
    })

    if (result.success && result.clientSecret && result.accountKey) {
      setPayment({ clientSecret: result.clientSecret, accountKey: result.accountKey })
      setLoading(false)
      return
    }
    if (result.success && result.url) {
      window.location.href = result.url // paid → Stripe's hosted page
      return
    }
    if (result.success && result.redirectTo) {
      router.push(result.redirectTo) // free → confirmation
      return
    }
    setLoading(false)
    setError(result.error ?? 'Something went wrong. Please try again.')
  }

  if (payment) {
    const stripePromise = stripePromiseFor(payment.accountKey)
    const options: StripeElementsOptions = {
      clientSecret: payment.clientSecret,
      appearance: { theme: 'stripe', variables: { colorPrimary: '#f97316', borderRadius: '12px' } },
    }
    return (
      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-bold text-gray-900">
            {count} {count === 1 ? 'ticket' : 'tickets'}
          </p>
          <p className="text-lg font-bold tabular-nums text-gray-900">{aud.format(total)}</p>
        </div>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {stripePromise && (
          <Elements stripe={stripePromise} options={options}>
            <PayForm
              amount={total}
              returnUrl={`/events/${eventSlug}/registered`}
              onError={setError}
            />
          </Elements>
        )}
      </div>
    )
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
        {editingDetails ? (
          <>
            <Input
              label="Your name"
              name="name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email address"
              name="email"
              type="email"
              required
              autoComplete="email"
              hint="We’ll email your tickets here."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
              <p className="truncate text-sm text-gray-500">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingDetails(true)}
              className="shrink-0 text-sm font-semibold text-orange-600 hover:underline"
            >
              Edit details
            </button>
          </div>
        )}
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

/**
 * The card step, inside `Elements` so it can reach the mounted PaymentElement.
 *
 * `confirmPayment` sends the buyer to `return_url` on success; the tickets
 * themselves are created by the webhook, not here, so a closed tab still ends
 * with a paid order and an emailed ticket.
 */
function PayForm({
  amount,
  returnUrl,
  onError,
}: {
  amount: number
  returnUrl: string
  onError: (m: string | null) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = React.useState(false)

  async function pay() {
    if (!stripe || !elements) return
    onError(null)
    setLoading(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${returnUrl}` },
    })
    // Only reached when the payment failed — success navigates away.
    if (error) {
      onError(error.message ?? 'Payment could not be completed.')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 p-4">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <button
        type="button"
        onClick={pay}
        disabled={loading || !stripe}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 py-3.5 text-base font-bold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? 'Processing…' : (
          <>
            <Check className="h-5 w-5" /> Pay {aud.format(amount)}
          </>
        )}
      </button>
    </div>
  )
}
