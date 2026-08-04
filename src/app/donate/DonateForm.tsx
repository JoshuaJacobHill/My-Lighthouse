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
import {
  createDonationIntentAction,
  createDonationSubscriptionCheckoutAction,
} from '@/lib/actions/donation.actions'
import { stripePromiseFor } from '@/lib/stripe-public'

// $25 leads deliberately — it's the price of a full $25 Trolley.
const PRESETS = [25, 50, 100, 250]

type AccountKey = 'CARE' | 'CHURCH'
type Frequency = 'once' | 'weekly' | 'fortnightly' | 'monthly'

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'once', label: 'One-off' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly' },
  { key: 'monthly', label: 'Monthly' },
]

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
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [frequency, setFrequency] = React.useState<Frequency>('once')
  const [redirecting, setRedirecting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const effectiveAmount = custom.trim() !== '' ? Number(custom) : amount
  const validAmount = Number.isFinite(effectiveAmount) && effectiveAmount > 0
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

  const recurring = frequency !== 'once'
  const freqLabel = FREQUENCIES.find((f) => f.key === frequency)?.label.toLowerCase() ?? ''

  async function startRecurring() {
    setError(null)
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email.')
      return
    }
    if (!validAmount || effectiveAmount < 2) {
      setError('Minimum donation is $2.')
      return
    }
    setRedirecting(true)
    const res = await createDonationSubscriptionCheckoutAction({
      fundSlug,
      amount: effectiveAmount,
      name,
      email,
      frequency: frequency as 'weekly' | 'fortnightly' | 'monthly',
      fundraiserId,
      message,
    })
    if (res.success && res.url) {
      window.location.href = res.url
      return
    }
    setRedirecting(false)
    setError(res.error ?? 'Something went wrong. Please try again.')
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      {/* Frequency */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">How often?</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {FREQUENCIES.map((f) => {
            const active = frequency === f.key
            return (
              <button
                type="button"
                key={f.key}
                onClick={() => setFrequency(f.key)}
                aria-pressed={active}
                className={
                  'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 sm:text-sm ' +
                  (active
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-orange-400')
                }
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Amount */}
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

      {/* Donor details */}
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="Your name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email address"
          type="email"
          required
          autoComplete="email"
          hint="We’ll send your receipt here."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Leave a message of support (optional)"
          maxLength={250}
          placeholder="e.g. Great cause — keep it up!"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {recurring ? (
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={redirecting}
          onClick={startRecurring}
        >
          {redirecting
            ? 'Taking you to secure checkout…'
            : validAmount
              ? `Set up ${freqLabel} gift of $${effectiveAmount} →`
              : `Set up ${freqLabel} gift`}
        </Button>
      ) : (
        <Elements stripe={stripePromise} options={options}>
          <CardSection
            fundSlug={fundSlug}
            fundName={fundName}
            fundraiserId={fundraiserId}
            amount={validAmount ? effectiveAmount : 0}
            name={name}
            email={email}
            message={message}
            onError={setError}
          />
        </Elements>
      )}

      <p className="text-center text-xs text-gray-400">
        {recurring
          ? 'Recurring gifts are handled securely by Stripe. Cancel any time.'
          : 'Payments are processed securely by Stripe. Lighthouse Care never sees your card details.'}
      </p>
    </div>
  )
}

function CardSection({
  fundSlug,
  fundName,
  fundraiserId,
  amount,
  name,
  email,
  message,
  onError,
}: {
  fundSlug: string
  fundName: string
  fundraiserId?: string
  amount: number
  name: string
  email: string
  message: string
  onError: (msg: string | null) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!stripe || !elements) return
    onError(null)
    if (!name.trim() || !email.trim()) {
      onError('Please enter your name and email.')
      return
    }
    setLoading(true)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      onError(submitError.message ?? 'Please check your card details.')
      setLoading(false)
      return
    }

    const res = await createDonationIntentAction({ fundSlug, amount, name, email, fundraiserId, message })
    if (!res.success || !res.clientSecret || !res.accountKey) {
      onError(res.error ?? 'Something went wrong. Please try again.')
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
    if (confirmError) {
      onError(confirmError.message ?? 'Payment could not be completed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <span className="text-sm font-medium text-gray-700">Card details</span>
        <div className="mt-2">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading || !stripe}>
        {loading ? 'Processing…' : amount > 0 ? `Donate $${amount} to ${fundName}` : 'Donate'}
      </Button>
    </form>
  )
}
