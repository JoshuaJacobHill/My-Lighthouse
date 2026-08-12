'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ImageIcon, Pencil } from 'lucide-react'
import {
  addOfflineSponsorAction,
  updateEventSponsorAction,
  removeEventSponsorAction,
} from '@/lib/actions/event.actions'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

type Tier = 'BRONZE' | 'SILVER' | 'GOLD'

export interface SponsorRow {
  id: string
  businessName: string
  tier: Tier
  amount: number
  logoUrl: string | null
  websiteUrl: string | null
  paid: boolean
}

const TIER_LABEL: Record<string, string> = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold' }
const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'

export function EventSponsorsManager({ eventId, sponsors }: { eventId: string; sponsors: SponsorRow[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [businessName, setBusinessName] = React.useState('')
  const [tier, setTier] = React.useState<Tier>('BRONZE')
  const [amount, setAmount] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState('')
  const [websiteUrl, setWebsiteUrl] = React.useState('')
  const [contactName, setContactName] = React.useState('')
  const [contactEmail, setContactEmail] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
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

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Sponsors ({sponsors.length})</h2>
          <p className="text-sm text-gray-500">Logos and links show on the public event page. Add or edit sponsors here.</p>
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
          <select className={input} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
          </select>
          <input className={input} type="number" min="1" step="1" placeholder="Amount (AUD)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input className={input} placeholder="Website (optional, e.g. sponsor.com.au)" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
          <input className={input} placeholder="Logo image URL (optional)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
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
          {sponsors.map((s) =>
            editingId === s.id ? (
              <SponsorEditRow
                key={s.id}
                sponsor={s}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSave={(data) =>
                  startTransition(async () => {
                    const res = await updateEventSponsorAction({ id: s.id, ...data })
                    if (!res.success) {
                      setError(res.error ?? 'Could not update sponsor.')
                      return
                    }
                    setError(null)
                    setEditingId(null)
                    router.refresh()
                  })
                }
              />
            ) : (
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
                  {s.websiteUrl && <p className="truncate text-xs text-orange-600">{s.websiteUrl}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setEditingId(s.id)
                  }}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => remove(s.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          )}
        </div>
      )}

      {error && !open && editingId === null && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  )
}

function SponsorEditRow({
  sponsor,
  pending,
  onSave,
  onCancel,
}: {
  sponsor: SponsorRow
  pending: boolean
  onSave: (data: { businessName: string; tier: Tier; amount: string; websiteUrl: string; logoUrl: string }) => void
  onCancel: () => void
}) {
  const [businessName, setBusinessName] = React.useState(sponsor.businessName)
  const [tier, setTier] = React.useState<Tier>(sponsor.tier)
  const [amount, setAmount] = React.useState(String(sponsor.amount))
  const [websiteUrl, setWebsiteUrl] = React.useState(sponsor.websiteUrl ?? '')
  const [logoUrl, setLogoUrl] = React.useState('')
  const uploadedLogo = sponsor.logoUrl?.startsWith('data:')

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
      <input className={input} placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
      <select className={input} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
        <option value="BRONZE">Bronze</option>
        <option value="SILVER">Silver</option>
        <option value="GOLD">Gold</option>
      </select>
      <input className={input} type="number" min="1" step="1" placeholder="Amount (AUD)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input className={input} placeholder="Website (e.g. sponsor.com.au)" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
      <input
        className={`${input} sm:col-span-2`}
        placeholder={uploadedLogo ? 'Replace logo with an image URL (leave blank to keep uploaded logo)' : 'Logo image URL'}
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
      />
      <div className="flex items-center gap-2 sm:col-span-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave({ businessName, tier, amount, websiteUrl, logoUrl })}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  )
}
