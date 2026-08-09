'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { createEventAction, updateEventAction } from '@/lib/actions/event.actions'
import type { EventInput } from '@/lib/validations'

export interface TicketTypeValues {
  id?: string
  name: string
  price: string
  quantityAvailable: string
  maxPerOrder: string
}

export interface EventFormValues {
  id?: string
  title: string
  slug: string
  description: string
  venue: string
  startsAt: string
  endsAt: string
  capacity: string
  fundId: string
  isPublished: boolean
  churchOnly: boolean
  ticketTypes: TicketTypeValues[]
}

const EMPTY_TICKET: TicketTypeValues = { name: '', price: '0', quantityAvailable: '', maxPerOrder: '' }

export function EventForm({
  event,
  funds,
}: {
  event?: EventFormValues
  funds: { id: string; name: string }[]
}) {
  const router = useRouter()
  const isEdit = Boolean(event?.id)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isPublished, setIsPublished] = React.useState(event?.isPublished ?? false)
  const [churchOnly, setChurchOnly] = React.useState(event?.churchOnly ?? false)
  const [tickets, setTickets] = React.useState<TicketTypeValues[]>(
    event?.ticketTypes?.length ? event.ticketTypes : [{ ...EMPTY_TICKET }]
  )

  function updateTicket(i: number, patch: Partial<TicketTypeValues>) {
    setTickets((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  function addTicket() {
    setTickets((prev) => [...prev, { ...EMPTY_TICKET }])
  }
  function removeTicket(i: number) {
    setTickets((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const data: EventInput = {
      title: (fd.get('title') as string) ?? '',
      slug: (fd.get('slug') as string) ?? '',
      description: (fd.get('description') as string) ?? '',
      venue: (fd.get('venue') as string) ?? '',
      startsAt: (fd.get('startsAt') as string) ?? '',
      endsAt: (fd.get('endsAt') as string) ?? '',
      capacity: (fd.get('capacity') as string) ?? '',
      fundId: (fd.get('fundId') as string) ?? '',
      isPublished,
      churchOnly,
      ticketTypes: tickets.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        quantityAvailable: t.quantityAvailable,
        maxPerOrder: t.maxPerOrder,
      })),
    }

    const result = isEdit
      ? await updateEventAction(event!.id!, data)
      : await createEventAction(data)

    setLoading(false)
    if (result.success) {
      router.push('/admin/events')
      router.refresh()
    } else {
      setError(result.error ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Event details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Event title" name="title" required defaultValue={event?.title} placeholder="e.g. Good Food Festival 2026" />
          <Input label="Link slug" name="slug" defaultValue={event?.slug} placeholder="auto-generated from the title" hint="Used in the event link. Leave blank to auto-generate." />
        </div>
        <Textarea label="Description" name="description" rows={4} required defaultValue={event?.description} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Venue" name="venue" defaultValue={event?.venue} placeholder="Optional" />
          <div className="flex flex-col gap-1">
            <label htmlFor="fundId" className="text-sm font-medium text-gray-700">Allocate proceeds to fund</label>
            <select
              id="fundId"
              name="fundId"
              defaultValue={event?.fundId ?? ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">No specific fund</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Starts" name="startsAt" type="datetime-local" required defaultValue={event?.startsAt} />
          <Input label="Ends" name="endsAt" type="datetime-local" defaultValue={event?.endsAt} hint="Optional" />
          <Input label="Overall capacity" name="capacity" type="number" min="1" step="1" defaultValue={event?.capacity} placeholder="Unlimited" />
        </div>
        <Checkbox
          label="Published"
          description="Unpublished events are hidden from the public. You can publish later."
          checked={isPublished}
          onCheckedChange={(v) => setIsPublished(v === true)}
        />
        <Checkbox
          label="Church only"
          description="Only church members can view this event."
          checked={churchOnly}
          onCheckedChange={(v) => setChurchOnly(v === true)}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Ticket types</h2>
          <Button type="button" variant="ghost" size="sm" onClick={addTicket}>
            <Plus className="h-4 w-4" /> Add ticket type
          </Button>
        </div>
        <p className="text-sm text-gray-500">Set a price of $0 for a free / RSVP ticket. Leave quantity blank for unlimited.</p>

        <div className="space-y-4">
          {tickets.map((t, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
                <Input label="Name" value={t.name} onChange={(e) => updateTicket(i, { name: e.target.value })} placeholder="e.g. General / Family / Free RSVP" required />
                <Input label="Price (AUD)" type="number" min="0" step="0.01" value={t.price} onChange={(e) => updateTicket(i, { price: e.target.value })} />
                <Input label="Quantity" type="number" min="0" step="1" value={t.quantityAvailable} onChange={(e) => updateTicket(i, { quantityAvailable: e.target.value })} placeholder="∞" />
                <Input label="Max / order" type="number" min="1" step="1" value={t.maxPerOrder} onChange={(e) => updateTicket(i, { maxPerOrder: e.target.value })} placeholder="—" />
                <button
                  type="button"
                  onClick={() => removeTicket(i)}
                  disabled={tickets.length === 1}
                  className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  aria-label="Remove ticket type"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/events')} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
