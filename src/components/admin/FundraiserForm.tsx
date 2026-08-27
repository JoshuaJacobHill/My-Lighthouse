'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { createFundraiserAction, updateFundraiserAction } from '@/lib/actions/fundraiser.actions'
import type { FundraiserInput } from '@/lib/validations'

export interface FundraiserFormValues {
  id?: string
  title: string
  slug: string
  story: string
  imageUrl: string
  goalAmount: string
  organiserName: string
  organiserEmail: string
  fundId: string
  isActive: boolean
}

export function FundraiserForm({
  fundraiser,
  funds,
}: {
  fundraiser?: FundraiserFormValues
  funds: { id: string; name: string }[]
}) {
  const router = useRouter()
  const isEdit = Boolean(fundraiser?.id)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isActive, setIsActive] = React.useState(fundraiser?.isActive ?? true)
  const [imageUrl, setImageUrl] = React.useState(fundraiser?.imageUrl ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const data: FundraiserInput = {
      title: (fd.get('title') as string) ?? '',
      slug: (fd.get('slug') as string) ?? '',
      story: (fd.get('story') as string) ?? '',
      imageUrl,
      goalAmount: (fd.get('goalAmount') as string) ?? '',
      organiserName: (fd.get('organiserName') as string) ?? '',
      organiserEmail: (fd.get('organiserEmail') as string) ?? '',
      fundId: (fd.get('fundId') as string) ?? '',
      isActive,
    }

    const result = isEdit
      ? await updateFundraiserAction(fundraiser!.id!, data)
      : await createFundraiserAction(data)

    setLoading(false)
    if (result.success) {
      router.push('/admin/fundraisers')
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Fundraiser title" name="title" required defaultValue={fundraiser?.title} placeholder="e.g. JCK Construction for Lighthouse Care" />
          <Input label="Link slug" name="slug" defaultValue={fundraiser?.slug} placeholder="auto-generated from the title" hint="Used in the public link. Leave blank to auto-generate." />
        </div>
        <Textarea label="Story" name="story" rows={6} required defaultValue={fundraiser?.story} hint="Tell supporters what this fundraiser is about." />
        <ImageUpload label="Header image" value={imageUrl} onChange={setImageUrl} folder="fundraisers" hint="Optional banner shown at the top of the fundraiser page." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Organiser / business name" name="organiserName" required defaultValue={fundraiser?.organiserName} placeholder="e.g. JCK Construction" />
          <Input label="Organiser email" name="organiserEmail" type="email" defaultValue={fundraiser?.organiserEmail} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Goal amount (AUD)" name="goalAmount" type="number" min="0" step="1" defaultValue={fundraiser?.goalAmount} placeholder="Optional" />
          <div className="flex flex-col gap-1">
            <label htmlFor="fundId" className="text-sm font-medium text-gray-700">Proceeds go to fund</label>
            <select
              id="fundId"
              name="fundId"
              required
              defaultValue={fundraiser?.fundId ?? ''}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="" disabled>Choose a fund…</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
        <Checkbox
          label="Active"
          description="Inactive fundraisers are hidden from the public."
          checked={isActive}
          onCheckedChange={(v) => setIsActive(v === true)}
        />
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create fundraiser'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/fundraisers')} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
