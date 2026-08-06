'use client'

import * as React from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import {
  createDonationIntentAction,
  createDonationSubscriptionIntentAction,
} from '@/lib/actions/donation.actions'
import { stripePromiseFor } from '@/lib/stripe-public'

// $25 leads deliberately — it's the price of a full $25 Trolley.
const PRESETS = [25, 50, 100, 250, 500, 1000]
const SUGGESTED = 25

type AccountKey = 'CARE' | 'CHURCH'
type Frequency = 'once' | 'weekly' | 'fortnightly' | 'monthly'

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'once', label: 'Give once' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly' },
  { key: 'monthly', label: 'Monthly' },
]

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export function DonateForm({
  fundSlug,
  fundName,
  fundraiserId,
  accountKey,
  initialName,
  initialEmail,
}: {
  fundSlug: string
  fundName: string
  fundraiserId?: string
  accountKey: AccountKey
  initialName?: string
  initialEmail?: string
}) {
  const [amountText, setAmountText] = React.useState('')
  const [name, setName] = React.useState(initialName ?? '')
  const [email, setEmail] = React.useState(initialEmail ?? '')
  const [message, setMessage] = React.useState('')
  const [company, setCompany] = React.useState('')
  const [frequency, setFrequency] = React.useState<Frequency>('once')
  const [error, setError] = React.useState<string | null>(null)

  const amount = Number(amountText)
  const validAmount = Number.isFinite(amount) && amount > 0
  const amountCents = Math.max(Math.round((validAmount ? amount : 0) * 100), 100)

  const stripePromise = React.useMemo(() => stripePromiseFor(accountKey), [accountKey])

  function onAmountChange(raw: string) {
    let v = raw.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
    const [whole, dec] = v.split('.')
    v = dec !== undefined ? `${whole}.${dec.slice(0, 2)}` : whole
    setAmountText(v)
  }

  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Card payments aren’t configured for this fund yet. Please check back shortly.
      </div>
    )
  }

  const recurring = frequency !== 'once'
  const freqLabel = FREQUENCIES.find((f) => f.key === frequency)?.label.toLowerCase() ?? ''

  const options: StripeElementsOptions = {
    mode: recurring ? 'subscription' : 'payment',
    amount: amountCents,
    currency: 'aud',
    appearance: { theme: 'stripe', variables: { colorPrimary: '#f97316', borderRadius: '12px' } },
  }

  const presetActive = (p: number) => Number(amountText) === p

  return (
    <div className="space-y-6">
      {/* Frequency */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1.5 sm:grid-cols-4">
        {FREQUENCIES.map((f) => {
          const active = frequency === f.key
          return (
            <button
              type="button"
              key={f.key}
              onClick={() => setFrequency(f.key)}
              aria-pressed={active}
              className={
                'rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ' +
                (active ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-800')
              }
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Presets */}
      <div className="grid grid-cols-3 gap-3">
        {PRESETS.map((p) => {
          const active = presetActive(p)
          return (
            <button
              type="button"
              key={p}
              onClick={() => setAmountText(String(p))}
              aria-pressed={active}
              className={
                'relative rounded-2xl border-2 py-4 text-lg font-bold transition-colors ' +
                (active ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-neutral-200 text-neutral-900 hover:border-orange-300')
              }
            >
              ${p}
              {p === SUGGESTED && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Suggested
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Big amount box */}
      <div className="flex items-center gap-3 rounded-2xl border-2 border-neutral-200 px-5 py-4 focus-within:border-orange-500">
        <div className="shrink-0">
          <span className="text-3xl font-extrabold text-neutral-900">$</span>
          <span className="block text-xs font-semibold text-neutral-400">AUD</span>
        </div>
        <input
          inputMode="decimal"
          value={amountText}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          aria-label="Donation amount"
          className="w-full min-w-0 appearance-none border-0 bg-transparent text-right text-4xl font-extrabold text-neutral-900 placeholder-neutral-300 outline-none focus:outline-none focus:ring-0"
        />
      </div>

      {/* Donor details */}
      <div className="space-y-4">
        <Field label="Your name" required>
          <input
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </Field>
        <Field label="Email address" hint="We’ll send your receipt here." required>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </Field>
        <Field label="Company / organisation (optional)">
          <input
            maxLength={120}
            placeholder="e.g. Acme Pty Ltd"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </Field>
        <Field label="Leave a message of support (optional)">
          <textarea
            maxLength={250}
            rows={2}
            placeholder="e.g. Great cause — keep it up!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </Field>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Elements key={frequency} stripe={stripePromise} options={options}>
        <CardSection
          fundSlug={fundSlug}
          fundName={fundName}
          fundraiserId={fundraiserId}
          amount={validAmount ? amount : 0}
          name={name}
          email={email}
          message={message}
          company={company}
          frequency={frequency}
          freqLabel={freqLabel}
          recurring={recurring}
          onError={setError}
        />
      </Elements>

      <p className="text-center text-xs text-neutral-400">
        {recurring
          ? 'Recurring gifts are processed securely by Stripe. Cancel any time.'
          : 'Payments are processed securely by Stripe. Lighthouse Care never sees your card details.'}
      </p>
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-orange-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-400">{hint}</span>}
    </label>
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
  company,
  frequency,
  freqLabel,
  recurring,
  onError,
}: {
  fundSlug: string
  fundName: string
  fundraiserId?: string
  amount: number
  name: string
  email: string
  message: string
  company: string
  frequency: Frequency
  freqLabel: string
  recurring: boolean
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
    if (amount <= 0) {
      onError('Please choose or enter an amount.')
      return
    }
    setLoading(true)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      onError(submitError.message ?? 'Please check your card details.')
      setLoading(false)
      return
    }

    const res = recurring
      ? await createDonationSubscriptionIntentAction({
          fundSlug,
          amount,
          name,
          email,
          frequency: frequency as 'weekly' | 'fortnightly' | 'monthly',
          fundraiserId,
          message,
          company,
        })
      : await createDonationIntentAction({ fundSlug, amount, name, email, fundraiserId, message, company })
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
        <span className="mb-2 block text-sm font-semibold text-neutral-900">Payment method</span>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      </div>

      {/* Summary */}
      <div className="border-t border-neutral-100 pt-4">
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>Your {recurring ? `${freqLabel} ` : ''}donation</span>
          <span className="tabular-nums">{aud.format(amount > 0 ? amount : 0)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-base font-bold text-neutral-900">
          <span>Total{recurring ? ` (${freqLabel})` : ' today'}</span>
          <span className="tabular-nums">{aud.format(amount > 0 ? amount : 0)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full rounded-full bg-orange-500 py-4 text-lg font-bold text-white transition-transform hover:bg-orange-600 active:scale-[0.99] disabled:opacity-50"
      >
        {loading
          ? 'Processing…'
          : amount > 0
            ? recurring
              ? `Give $${amount} ${freqLabel}`
              : `Donate $${amount}`
            : 'Donate now'}
      </button>
    </form>
  )
}
