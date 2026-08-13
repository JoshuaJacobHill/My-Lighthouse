'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { ChevronLeft } from 'lucide-react'
import { startGiveAgainPaymentAction } from '@/lib/actions/give.actions'
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
  fundName,
  fundSlug = 'lighthouse-care',
}: {
  userName: string
  fundName: string
  fundSlug?: string
}) {
  const router = useRouter()
  const specificFund = fundSlug !== 'lighthouse-care'
  const [step, setStep] = React.useState<1 | 2>(1)
  const [amountText, setAmountText] = React.useState('')
  const [frequency, setFrequency] = React.useState<Frequency>('once')

  const amount = Number(amountText)
  const validAmount = Number.isFinite(amount) && amount >= MIN
  const recurring = frequency !== 'once'
  const freqLabel = FREQUENCIES.find((f) => f.key === frequency)?.label.toLowerCase() ?? ''

  function onAmountChange(raw: string) {
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

        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col">
          {/* Back */}
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            aria-label="Back"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm transition-transform active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Giving as */}
          <div className="mt-10">
            {specificFund && <p className="text-sm font-semibold text-orange-100">Giving to {fundName}</p>}
            <p className="text-lg font-extrabold tracking-tight">Giving as {userName}</p>
            <Link href="/dashboard/account" className="text-sm font-medium text-orange-100 underline underline-offset-2">
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
              className="ml-3 w-full min-w-0 appearance-none border-0 bg-transparent text-[5.5rem] font-extrabold leading-none tracking-tighter placeholder-white/30 caret-white outline-none focus:outline-none focus:ring-0 sm:text-8xl"
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
          <div className="mt-auto flex justify-center pt-12">
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
        </div>
      </main>
    )
  }

  return (
    <PayStep
      amount={amount}
      recurring={recurring}
      frequency={frequency}
      freqLabel={freqLabel}
      fundName={fundName}
      fundSlug={fundSlug}
      onBack={() => setStep(1)}
    />
  )
}

function PayStep({
  amount,
  recurring,
  frequency,
  freqLabel,
  fundName,
  fundSlug,
  onBack,
}: {
  amount: number
  recurring: boolean
  frequency: Frequency
  freqLabel: string
  fundName: string
  fundSlug: string
  onBack: () => void
}) {
  const [init, setInit] = React.useState<{
    clientSecret: string
    customerSessionClientSecret: string | null
    accountKey: AccountKey
  } | null>(null)
  const [initError, setInitError] = React.useState<string | null>(null)
  const started = React.useRef(false)

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    startGiveAgainPaymentAction({ amount, frequency, fundSlug }).then((res) => {
      if (res.success && res.clientSecret && res.accountKey) {
        setInit({
          clientSecret: res.clientSecret,
          customerSessionClientSecret: res.customerSessionClientSecret ?? null,
          accountKey: res.accountKey,
        })
      } else {
        setInitError(res.error ?? 'Could not start payment. Please try again.')
      }
    })
  }, [amount, frequency, fundSlug])

  const stripePromise = React.useMemo(
    () => (init ? stripePromiseFor(init.accountKey) : null),
    [init]
  )

  const options: StripeElementsOptions | null = init
    ? {
        clientSecret: init.clientSecret,
        ...(init.customerSessionClientSecret
          ? { customerSessionClientSecret: init.customerSessionClientSecret }
          : {}),
        appearance: { theme: 'stripe', variables: { colorPrimary: '#f97316', borderRadius: '12px' } },
      }
    : null

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

        {initError ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {initError}
            <button onClick={onBack} className="mt-3 block font-semibold text-red-800 underline">
              Go back
            </button>
          </div>
        ) : !init || !options || !stripePromise ? (
          <div className="mt-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-orange-500" />
          </div>
        ) : (
          <Elements stripe={stripePromise} options={options}>
            <PayForm
              amount={amount}
              recurring={recurring}
              freqLabel={freqLabel}
              returnUrl={`/donate/success?acct=${init.accountKey}`}
            />
          </Elements>
        )}

        <p className="mt-6 text-center text-xs text-neutral-400">
          Processed securely by Stripe. We save your card so giving again is one tap — manage it any time in your
          account.
        </p>
      </div>
    </main>
  )
}

function PayForm({
  amount,
  recurring,
  freqLabel,
  returnUrl,
}: {
  amount: number
  recurring: boolean
  freqLabel: string
  returnUrl: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [expressReady, setExpressReady] = React.useState(false)

  async function confirm() {
    if (!stripe || !elements) return
    setError(null)
    setLoading(true)
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${returnUrl}` },
    })
    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be completed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-8">
      {/* Apple Pay / Google Pay / Link — appears only when available */}
      <ExpressCheckoutElement
        onReady={(e) => setExpressReady(Boolean(e.availablePaymentMethods))}
        onConfirm={confirm}
      />
      {expressReady && (
        <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" /> or pay by card <span className="h-px flex-1 bg-neutral-200" />
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={confirm}
        disabled={loading || !stripe}
        className="mt-6 w-full rounded-full bg-neutral-950 py-5 text-xl font-extrabold uppercase tracking-wide text-white transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? 'Processing…' : `Pay $${amount}${recurring ? ` ${freqLabel}` : ''}`}
      </button>
    </div>
  )
}
