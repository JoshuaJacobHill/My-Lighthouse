'use client'

import * as React from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { Upload, Check } from 'lucide-react'
import { startEventSponsorAction } from '@/lib/actions/event-public.actions'
import { SPONSOR_TIERS, type SponsorTierKey } from '@/lib/sponsor-tiers'
import { stripePromiseFor } from '@/lib/stripe-public'

type AccountKey = 'CARE' | 'CHURCH'
const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const TIER_ORDER: SponsorTierKey[] = ['BRONZE', 'SILVER', 'GOLD']
const TIER_STYLE: Record<SponsorTierKey, string> = {
  BRONZE: 'from-amber-600 to-amber-700',
  SILVER: 'from-slate-400 to-slate-500',
  GOLD: 'from-yellow-500 to-amber-500',
}

async function compressToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const max = 400
  let { width, height } = img
  if (width > max || height > max) {
    const s = Math.min(max / width, max / height)
    width = Math.round(width * s)
    height = Math.round(height * s)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

export function EventSponsorFlow({
  eventId,
  eventSlug,
  initialName,
  initialEmail,
  accountKey,
}: {
  eventId: string
  eventSlug: string
  initialName?: string
  initialEmail?: string
  accountKey: AccountKey
}) {
  const [tier, setTier] = React.useState<SponsorTierKey | null>(null)
  const [amount, setAmount] = React.useState(0)
  const [businessName, setBusinessName] = React.useState('')
  const [contactName, setContactName] = React.useState(initialName ?? '')
  const [contactEmail, setContactEmail] = React.useState(initialEmail ?? '')
  const [logo, setLogo] = React.useState<string | null>(null)
  const [clientSecret, setClientSecret] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  function pickTier(t: SponsorTierKey) {
    setTier(t)
    setAmount(SPONSOR_TIERS[t].min)
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setLogo(await compressToDataUrl(file))
    } catch {
      setError('Could not read that image — try a PNG or JPG.')
    }
  }

  async function toPayment() {
    setError(null)
    if (!tier) return
    if (!businessName.trim() || !contactEmail.trim()) {
      setError('Please enter your business name and email.')
      return
    }
    if (!logo) {
      setError('Please upload your logo — it appears on the event page.')
      return
    }
    setLoading(true)
    const res = await startEventSponsorAction({ eventId, tier, amount, businessName, contactName, contactEmail, logoUrl: logo })
    setLoading(false)
    if (!res.success || !res.clientSecret) {
      setError(res.error ?? 'Something went wrong.')
      return
    }
    setClientSecret(res.clientSecret)
  }

  // ── Payment step ──
  if (clientSecret && tier) {
    const stripePromise = stripePromiseFor(accountKey)
    const options: StripeElementsOptions = {
      clientSecret,
      appearance: { theme: 'stripe', variables: { colorPrimary: '#f97316', borderRadius: '12px' } },
    }
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">
          {SPONSOR_TIERS[tier].label} sponsorship — {aud.format(amount)}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{businessName}</p>
        {stripePromise && (
          <Elements stripe={stripePromise} options={options}>
            <PayForm amount={amount} returnUrl={`/events/${eventSlug}?sponsored=1`} onError={setError} />
          </Elements>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  // ── Tier + details step ──
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TIER_ORDER.map((t) => {
          const info = SPONSOR_TIERS[t]
          const active = tier === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => pickTier(t)}
              className={
                'rounded-2xl border-2 p-5 text-left transition-colors ' +
                (active ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300')
              }
            >
              <span className={`inline-block rounded-full bg-gradient-to-r ${TIER_STYLE[t]} px-3 py-1 text-xs font-bold uppercase tracking-wide text-white`}>
                {info.label}
              </span>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                {aud.format(info.min)}–{aud.format(info.max)}
              </p>
            </button>
          )
        })}
      </div>

      {tier && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Your amount: <span className="font-bold text-orange-600">{aud.format(amount)}</span>
            </label>
            <input
              type="range"
              min={SPONSOR_TIERS[tier].min}
              max={SPONSOR_TIERS[tier].max}
              step={tier === 'GOLD' ? 1000 : 250}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-2 w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{aud.format(SPONSOR_TIERS[tier].min)}</span>
              <span>{aud.format(SPONSOR_TIERS[tier].max)}</span>
            </div>
          </div>

          <input
            placeholder="Business / organisation name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              placeholder="Contact name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <input
              type="email"
              placeholder="Contact email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Logo upload */}
          <div>
            <span className="text-sm font-medium text-gray-700">Your logo</span>
            <p className="text-xs text-gray-400">Shows on the event page and becomes your account picture. PNG with a transparent background looks best.</p>
            <div className="mt-2 flex items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-orange-400">
                <Upload className="h-4 w-4" /> {logo ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
              </label>
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo preview" className="h-12 w-auto max-w-[120px] rounded border border-gray-100 object-contain" />
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={toPayment}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-base font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? 'Preparing…' : `Continue to payment · ${aud.format(amount)}`}
          </button>
        </div>
      )}
    </div>
  )
}

function PayForm({ amount, returnUrl, onError }: { amount: number; returnUrl: string; onError: (m: string | null) => void }) {
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
    if (error) {
      onError(error.message ?? 'Payment could not be completed.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-5">
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
