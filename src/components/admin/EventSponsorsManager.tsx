'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ImageIcon } from 'lucide-react'
import { addOfflineSponsorAction, removeEventSponsorAction } from '@/lib/actions/event.actions'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export interface SponsorRow {
  id: string
  businessName: string
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  amount: number
  logoUrl: string | null
  paid: boolean
}

const TIER_LABEL: Record<string, string> = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold' }

export function EventSponsorsManager({ eventId, sponsors }: { eventId: string; sponsors: SponsorRow[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [businessName, setBusinessName] = React.useState('')
  const [tier, setTier] = React.useState<'BRONZE' | 'SILVER' | 'GOLD'>('BRONZE')
  const [amount, setAmount] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState('')
  const [websiteUrl, setWebsiteUrl] = React.useState('')
  const [contactName, setContactName] = React.useState('')
  const [contactEmail, setContactEmail] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await addOfflineSponsorAction({ eventId, businessName, tier, amount, logoUrl, websiteUrl, contactName, contactEmail })
      if (!res.success) {
        setError(res.error ?? 'Could not add sponsor.')
        return
      }
      setBusinessName('')
      setAmount('')
      setLogoUrl('')
      setWebsiteUrl('')
      setContactName('')
      setContactEmail('')
      setOpen(false)
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!confirm('Remove this sponsor?')) return
    startTransition(async () => {
      await removeEventSponsorAction(id)
      router.refresh()
    })
  }

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Sponsors ({sponsors.length})</h2>
          <p className="text-sm text-gray-500">Logos show on the public event page. Add offline sponsors here.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" /> Add sponsor
        </button>
      </div>

      {open && (
        <form onSubmit={add} className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
          <input className={input} placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
          <select className={input} value={tier} onChange={(e) => setTier(e.target.value as 'BRONZE' | 'SILVER' | 'GOLD')}>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
          </select>
          <input className={input} type="number" min="1" step="1" placeholder="Amount (AUD)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input className={input} placeholder="Logo image URL (optional)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          <input className={input} placeholder="Website (optional, e.g. sponsor.com.au)" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
          <input className={input} placeholder="Contact name (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <input className={input} type="email" placeholder="Contact email (optional)" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
              {pending ? 'Adding…' : 'Add sponsor'}
            </button>
          </div>
        </form>
      )}

      {sponsors.length > 0 && (
        <div className="mt-5 divide-y divide-gray-100">
          {sponsors.map((s) => (
            <div key={s.id} className="flex items-center gap-4 py-3">
              <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-black p-1.5">
                {s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt={s.businessName} className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-gray-500" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{s.businessName}</p>
                <p className="text-xs text-gray-500">
                  {TIER_LABEL[s.tier]} · {aud.format(s.amount)}
                  {!s.paid && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">Unpaid</span>}
                </p>
              </div>
              <button type="button" onClick={() => remove(s.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
