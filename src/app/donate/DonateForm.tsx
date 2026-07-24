'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createDonationCheckoutAction } from '@/lib/actions/donation.actions'

// $25 leads deliberately — it's the price of a full $25 Trolley.
const PRESETS = [25, 50, 100, 250]

export function DonateForm({
  fundSlug,
  fundName,
  fundraiserId,
}: {
  fundSlug: string
  fundName: string
  fundraiserId?: string
}) {
  const [amount, setAmount] = React.useState<number>(25)
  const [custom, setCustom] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const effectiveAmount = custom !== '' ? Number(custom) : amount

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const result = await createDonationCheckoutAction({
      fundSlug,
      amount: effectiveAmount,
      name: (fd.get('name') as string) ?? '',
      email: (fd.get('email') as string) ?? '',
      fundraiserId,
    })

    if (result.success && result.url) {
      // Hand off to Stripe's hosted checkout.
      window.location.href = result.url
      return
    }
    setLoading(false)
    setError(result.error ?? 'Something went wrong. Please try again.')
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Choose an amount</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const active = custom === '' && amount === p
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

      <div className="grid grid-cols-1 gap-4">
        <Input label="Your name" name="name" required autoComplete="name" />
        <Input
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="email"
          hint="We’ll send your receipt here."
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading
          ? 'Taking you to checkout…'
          : effectiveAmount > 0
            ? `Donate $${effectiveAmount} to ${fundName}`
            : 'Donate'}
      </Button>
    </form>
  )
}
