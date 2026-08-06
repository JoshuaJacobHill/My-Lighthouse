'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { ChevronLeft } from 'lucide-react'
import {
  createDonationIntentAction,
  createDonationSubscriptionIntentAction,
} from '@/lib/actions/donation.actions'
import { stripePromiseFor } from '@/lib/stripe-public'

type AccountKey = 'CARE' | 'CHURCH'
type Frequency = 'once' | 'weekly' | 'fortnightly' | 'monthly'

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'once', label: 'Once' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'fortnightly', label: 'Fortnightly' },
  { key: 'monthly', label: 'Monthly' },
]

// Faint, gently scrolling impact lines — brand facts, never pity language.
const IMPACTS = [
  '$25 fills a trolley with a week of essentials',
  '$50 helps two families doing it tough',
  '$100 is a week of groceries for four families',
  '$10 puts fresh fruit and veg on the table',
  '100% of profit is reinvested into the mission',
  '750,000 people supported with food this year',
]

const MIN = 2

export function GiveAgainFlow({
  userName,
  email,
  fundSlug,
  fundName,
  accountKey,
}: {
  userName: string
  email: string
  fundSlug: string
  fundName: string
  accountKey: AccountKey
}) {
  const router = useRouter()
  const [step, setStep] = React.useState<1 | 2>(1)
  const [amountText, setAmountText] = React.useState('')
  const [frequency, setFrequency] = React.useState<Frequency>('once')

  const amount = Number(amountText)
  const validAmount = Number.isFinite(amount) && amount >= MIN
  const amountCents = Math.max(Math.round((validAmount ? amount : 0) * 100), 100)
  const recurring = frequency !== 'once'
  const freqLabel = FREQUENCIES.find((f) => f.key === frequency)?.label.toLowerCase() ?? ''

  function onAmountChange(raw: string) {
    // Digits with at most one decimal point and two decimal places.
    let v = raw.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
    const [whole, dec] = v.split('.')
    v = dec !== undefined ? `${whole}.${dec.slice(0, 2)}` : whole
    setAmountText(v)
  }

  if (step === 1) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-orange-500 px-6 pb-10 pt-6 text-white">
        <style>{`
          @keyframes ga-scroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }
          .ga-scroll { animation: ga-scroll 18s linear infinite; }
        `}</style>

        {/* Back */}
        <button
          type="button"
          onClick={() => router.push('/donor')}
          aria-label="Back"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm transition-transform active:scale-95"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Giving as */}
        <div className="mt-10">
          <p className="text-lg font-extrabold tracking-tight">Giving as {userName}</p>
          <Link href="/donor/account" className="text-sm font-medium text-orange-100 underline underline-offset-2">
            Not you? Change
          </Link>
        </div>

        {/* Amount entry */}
        <div className="mt-12 flex items-start">
          <span className="text-[5.5rem] font-extrabold leading-none tracking-tighter sm:text-8xl">$</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amountText}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0"
            aria-label="Donation amount"
            className="ga-amount w-full min-w-0 bg-transparent text-[5.5rem] font-extrabold leading-none tracking-tighter placeholder-white/30 caret-white outline-none sm:text-8xl"
          />
        </div>

        {/* Scrolling faint impacts */}
        <div className="relative mt-6 h-24 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]">
          <div className="ga-scroll space-y-2 text-lg font-semibold text-white/35">
            {[...IMPACTS, ...IMPACTS].map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div className="mt-8 flex flex-wrap gap-3">
          {FREQUENCIES.map((f) => {
            const active = frequency === f.key
            return (
              <button
                type="button"
                key={f.key}
                onClick={() => setFrequency(f.key)}
                aria-pressed={active}
                className={
                  'rounded-full border-2 px-6 py-3 text-sm font-extrabold uppercase tracking-wide transition-colors ' +
                  (active
                    ? 'border-white bg-white text-orange-600'
                    : 'border-white/70 text-white hover:border-white')
                }
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Next */}
        <div className="mt-14 flex justify-center">
          <button
            type="button"
            disabled={!validAmount}
            onClick={() => setStep(2)}
            className="w-full max-w-md rounded-full bg-neutral-950 py-5 text-xl font-extrabold uppercase tracking-wide text-white transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            Next
          </button>
        </div>
        {!validAmount && amountText !== '' && (
          <p className="mt-3 text-center text-sm text-orange-100">Minimum gift is ${MIN}.</p>
        )}
      </main>
    )
  }

  // ── Step 2: payment ──
  return (
    <PayStep
      amount={amount}
      amountCents={amountCents}
      recurring={recurring}
      frequency={frequency}
      freqLabel={freqLabel}
      fundSlug={fundSlug}
      fundName={fundName}
      accountKey={accountKey}
      name={userName}
      email={email}
      onBack={() => setStep(1)}
    />
  )
}

function PayStep({
  amount,
  amountCents,
  recurring,
  frequency,
  freqLabel,
  fundSlug,
  fundName,
  accountKey,
  name,
  email,
  onBack,
}: {
  amount: number
  amountCents: number
  recurring: boolean
  frequency: Frequency
  freqLabel: string
  fundSlug: string
  fundName: string
  accountKey: AccountKey
  name: string
  email: string
  onBack: () => void
}) {
  const stripePromise = React.useMemo(() => stripePromiseFor(accountKey), [accountKey])

  const options: StripeElementsOptions = {
    mode: recurring ? 'subscription' : 'payment',
    amount: amountCents,
    currency: 'aud',
    appearance: { theme: 'stripe', variables: { colorPrimary: '#f97316', borderRadius: '12px' } },
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 pb-10 pt-6">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-base font-semibold text-neutral-700">Payment</p>
          <span className="h-12 w-12" />
        </div>

        <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-orange-600">
          Giving ${amount}
          {recurring && <span className="text-neutral-400"> {freqLabel}</span>}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">to {fundName}</p>

        {!stripePromise ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Card payments aren’t configured yet. Please try again shortly.
          </div>
        ) : (
          <Elements key={`${frequency}-${amountCents}`} stripe={stripePromise} options={options}>
            <PayForm
              amount={amount}
              recurring={recurring}
              frequency={frequency}
              freqLabel={freqLabel}
              fundSlug={fundSlug}
              name={name}
              email={email}
            />
          </Elements>
        )}

        <p className="mt-6 text-center text-xs text-neutral-400">
          Processed securely by Stripe. {recurring ? 'Cancel any time from your account.' : ''}
        </p>
      </div>
    </main>
  )
}

function PayForm({
  amount,
  recurring,
  frequency,
  freqLabel,
  fundSlug,
  name,
  email,
}: {
  amount: number
  recurring: boolean
  frequency: Frequency
  freqLabel: string
  fundSlug: string
  name: string
  email: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!stripe || !elements) return
    setError(null)
    setLoading(true)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Please check your card details.')
      setLoading(false)
      return
    }

    const res =
      recurring && frequency !== 'once'
        ? await createDonationSubscriptionIntentAction({
            fundSlug,
            amount,
            name,
            email,
            frequency: frequency as 'weekly' | 'fortnightly' | 'monthly',
          })
        : await createDonationIntentAction({ fundSlug, amount, name, email })

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
    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be completed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className="mt-6 w-full rounded-full bg-neutral-950 py-5 text-xl font-extrabold uppercase tracking-wide text-white transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? 'Processing…' : `Pay $${amount}${recurring ? ` ${freqLabel}` : ''}`}
      </button>
    </form>
  )
}
