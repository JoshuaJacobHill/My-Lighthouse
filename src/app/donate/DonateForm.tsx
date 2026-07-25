'use client'

import * as React from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createDonationIntentAction } from '@/lib/actions/donation.actions'
import { stripePromiseFor } from '@/lib/stripe-public'

// $25 leads deliberately — it's the price of a full $25 Trolley.
const PRESETS = [25, 50, 100, 250]

type AccountKey = 'CARE' | 'CHURCH'

export function DonateForm({
  fundSlug,
  fundName,
  fundraiserId,
  accountKey,
}: {
  fundSlug: string
  fundName: string
  fundraiserId?: string
  accountKey: AccountKey
}) {
  const [amount, setAmount] = React.useState<number>(25)
  const [custom, setCustom] = React.useState('')

  const effectiveAmount = custom.trim() !== '' ? Number(custom) : amount
  const validAmount = Number.isFinite(effectiveAmount) && effectiveAmount > 0
  // Stripe requires the Elements amount up front; keep it at/above the 50c floor
  // even while the field is mid-edit. Real validation ($2 min) happens server-side.
  const amountCents = Math.max(Math.round((validAmount ? effectiveAmount : 0) * 100), 100)

  const stripePromise = React.useMemo(() => stripePromiseFor(accountKey), [accountKey])

  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Card payments aren’t configured for this fund yet. Please check back shortly.
      </div>
    )
  }

  const options: StripeElementsOptions = {
    mode: 'payment',
    amount: amountCents,
    currency: 'aud',
    appearance: {
      theme: 'stripe',
      variables: { colorPrimary: '#f97316', borderRadius: '8px' },
    },
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Choose an amount</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const active = custom.trim() === '' && amount === p
            return (
              <button
                type="button"
                key={p}
                onClick={() => {
                  setAmount(p)
                  setCustom('')
                }}
                aria-pressed={active}
                className={
                  'rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ' +
                  (active
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-orange-400')
                }
              >
                ${p}
              </button>
            )
          })}
        </div>
        <div className="mt-3">
          <Input
            label="Or enter your own amount (AUD)"
            name="customAmount"
            type="number"
            min="2"
            step="1"
            inputMode="decimal"
            placeholder="e.g. 75"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>
      </fieldset>

      <Elements stripe={stripePromise} options={options}>
        <CheckoutInner
          fundSlug={fundSlug}
          fundName={fundName}
          fundraiserId={fundraiserId}
          amount={validAmount ? effectiveAmount : 0}
        />
      </Elements>
    </div>
  )
}

function CheckoutInner({
  fundSlug,
  fundName,
  fundraiserId,
  amount,
}: {
  fundSlug: string
  fundName: string
  fundraiserId?: string
  amount: number
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!stripe || !elements) return
    setError(null)
    setLoading(true)

    // Validate the card details before we create a PaymentIntent.
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Please check your card details.')
      setLoading(false)
      return
    }

    // Create the PaymentIntent on the fund's account, then confirm on-page.
    const res = await createDonationIntentAction({
      fundSlug,
      amount,
      name,
      email,
      fundraiserId,
      message,
    })
    if (!res.success || !res.clientSecret || !res.accountKey) {
      setError(res.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret: res.clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/donate/success?acct=${res.accountKey}`,
        receipt_email: email,
      },
    })
    // If we get here, confirmation failed (otherwise the browser has redirected).
    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be completed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
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
          hint="We’ll send your receipt here."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Leave a message of support (optional)"
          name="message"
          maxLength={250}
          placeholder="e.g. Great cause — keep it up!"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <div>
        <span className="text-sm font-medium text-gray-700">Card details</span>
        <div className="mt-2">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading || !stripe}>
        {loading
          ? 'Processing…'
          : amount > 0
            ? `Donate $${amount} to ${fundName}`
            : 'Donate'}
      </Button>
    </form>
  )
}
