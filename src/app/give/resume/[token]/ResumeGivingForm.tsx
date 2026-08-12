'use client'

import * as React from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createDonationSubscriptionIntentAction } from '@/lib/actions/donation.actions'
import { stripePromiseFor } from '@/lib/stripe-public'

type AccountKey = 'CARE' | 'CHURCH'
type Frequency = 'weekly' | 'fortnightly' | 'monthly'

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly' },
  { key: 'monthly', label: 'Monthly' },
]

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export function ResumeGivingForm({
  migrationIntentId,
  fundSlug,
  fundName,
  accountKey,
  initialName,
  initialEmail,
  initialCompany,
  initialAmount,
  initialFrequency,
}: {
  migrationIntentId: string
  fundSlug: string
  fundName: string
  accountKey: AccountKey
  initialName: string
  initialEmail: string
  initialCompany: string
  initialAmount: number
  initialFrequency: Frequency
}) {
  const [editing, setEditing] = React.useState(false)
  const [amount, setAmount] = React.useState<number>(initialAmount)
  const [amountText, setAmountText] = React.useState(String(initialAmount))
  const [frequency, setFrequency] = React.useState<Frequency>(initialFrequency)
  const [name, setName] = React.useState(initialName)
  const [company, setCompany] = React.useState(initialCompany)
  const [error, setError] = React.useState<string | null>(null)

  const validAmount = Number.isFinite(amount) && amount > 0
  const amountCents = Math.max(Math.round((validAmount ? amount : 0) * 100), 100)

  const stripePromise = React.useMemo(() => stripePromiseFor(accountKey), [accountKey])

  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Card payments aren’t configured yet. Please contact us and we’ll sort it out.
      </div>
    )
  }

  const freqLabel = FREQUENCIES.find((f) => f.key === frequency)?.label.toLowerCase() ?? ''

  const options: StripeElementsOptions = {
    mode: 'subscription',
    amount: amountCents,
    currency: 'aud',
    appearance: { theme: 'stripe', variables: { colorPrimary: '#f97316', borderRadius: '8px' } },
  }

  function commitAmount() {
    const n = Number(amountText)
    if (Number.isFinite(n) && n > 0) setAmount(n)
    else setAmountText(String(amount))
  }

  return (
    <div className="space-y-5">
      {/* Confirmed summary — editable */}
      <div className="rounded-2xl border border-gray-200 bg-orange-50/60 p-5">
        {!editing ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-500">Your giving</p>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                  Paused
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {aud.format(validAmount ? amount : 0)}{' '}
                <span className="text-lg font-semibold text-gray-600">{freqLabel}</span>
              </p>
              <p className="mt-0.5 text-sm text-gray-600">to {fundName}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-600"
            >
              <Pencil className="h-3.5 w-3.5" /> Change
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-700">How often?</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
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
            </div>
            <Input
              label="Amount (AUD)"
              type="number"
              min="2"
              step="1"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              onBlur={commitAmount}
            />
            <button
              type="button"
              onClick={() => {
                commitAmount()
                setEditing(false)
              }}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Donor details — prefilled, editable (email is fixed to the invite) */}
      <div className="grid grid-cols-1 gap-4">
        <Input label="Your name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Company / organisation (optional)"
          maxLength={120}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <Input label="Email address" type="email" value={initialEmail} disabled readOnly hint="Your receipt goes here." />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Elements key={`${frequency}-${amountCents}`} stripe={stripePromise} options={options}>
        <CardSection
          migrationIntentId={migrationIntentId}
          fundSlug={fundSlug}
          amount={validAmount ? amount : 0}
          name={name}
          email={initialEmail}
          company={company}
          frequency={frequency}
          freqLabel={freqLabel}
          accountKey={accountKey}
          onError={setError}
        />
      </Elements>

      <p className="text-center text-xs text-gray-400">
        Processed securely by Stripe. You can change or cancel any time from your account.
      </p>
    </div>
  )
}

function CardSection({
  migrationIntentId,
  fundSlug,
  amount,
  name,
  email,
  company,
  frequency,
  freqLabel,
  accountKey,
  onError,
}: {
  migrationIntentId: string
  fundSlug: string
  amount: number
  name: string
  email: string
  company: string
  frequency: Frequency
  freqLabel: string
  accountKey: AccountKey
  onError: (msg: string | null) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!stripe || !elements) return
    onError(null)
    if (!name.trim()) {
      onError('Please enter your name.')
      return
    }
    setLoading(true)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      onError(submitError.message ?? 'Please check your card details.')
      setLoading(false)
      return
    }

    const res = await createDonationSubscriptionIntentAction({
      fundSlug,
      amount,
      name,
      email,
      frequency,
      company,
      migrationIntentId,
    })
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
        {loading ? 'Processing…' : amount > 0 ? `Confirm my ${freqLabel} gift of $${amount}` : 'Confirm my gift'}
      </Button>
    </form>
  )
}
