'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { createFundAction, updateFundAction } from '@/lib/actions/fund.actions'
import type { FundInput } from '@/lib/validations'

export interface FundFormValues {
  id?: string
  name: string
  slug: string
  description: string
  goalAmount: string
  startsAt: string
  endsAt: string
  sortOrder: string
  isActive: boolean
  showPublicProgress: boolean
  imageUrl: string
  tagline: string
  showOnDashboard: boolean
  depositAccount: string
}

const EMPTY: FundFormValues = {
  name: '',
  slug: '',
  description: '',
  goalAmount: '',
  startsAt: '',
  endsAt: '',
  sortOrder: '0',
  isActive: true,
  showPublicProgress: false,
  imageUrl: '',
  tagline: '',
  showOnDashboard: false,
  depositAccount: 'CARE',
}

export function FundForm({ fund }: { fund?: FundFormValues }) {
  const router = useRouter()
  const isEdit = Boolean(fund?.id)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isActive, setIsActive] = React.useState(fund?.isActive ?? EMPTY.isActive)
  const [showPublicProgress, setShowPublicProgress] = React.useState(
    fund?.showPublicProgress ?? EMPTY.showPublicProgress
  )
  const [showOnDashboard, setShowOnDashboard] = React.useState(
    fund?.showOnDashboard ?? EMPTY.showOnDashboard
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const data: FundInput = {
      name: (fd.get('name') as string) ?? '',
      slug: (fd.get('slug') as string) ?? '',
      description: (fd.get('description') as string) ?? '',
      goalAmount: (fd.get('goalAmount') as string) ?? '',
      startsAt: (fd.get('startsAt') as string) ?? '',
      endsAt: (fd.get('endsAt') as string) ?? '',
      sortOrder: (fd.get('sortOrder') as string) ?? '0',
      isActive,
      showPublicProgress,
      imageUrl: (fd.get('imageUrl') as string) ?? '',
      tagline: (fd.get('tagline') as string) ?? '',
      showOnDashboard,
      depositAccount: ((fd.get('depositAccount') as string) ?? 'CARE') as 'CARE' | 'CHURCH',
    }

    const result = isEdit
      ? await updateFundAction(fund!.id!, data)
      : await createFundAction(data)

    setLoading(false)

    if (result.success) {
      router.push('/admin/funds')
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

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Fund name"
            name="name"
            required
            defaultValue={fund?.name}
            placeholder="e.g. Christmas Appeal"
            hint="Shown to donors when they choose where their gift goes."
          />
          <Input
            label="Link slug"
            name="slug"
            defaultValue={fund?.slug}
            placeholder="auto-generated from the name"
            hint="Used in the donate link. Leave blank to generate from the name."
          />
        </div>

        <Textarea
          label="Description"
          name="description"
          rows={3}
          defaultValue={fund?.description}
          hint="Optional. A short line about what this fund supports."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Goal amount (AUD)"
            name="goalAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={fund?.goalAmount}
            placeholder="Optional"
          />
          <Input
            label="Starts"
            name="startsAt"
            type="date"
            defaultValue={fund?.startsAt}
            hint="Optional"
          />
          <Input
            label="Ends"
            name="endsAt"
            type="date"
            defaultValue={fund?.endsAt}
            hint="Optional"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Sort order"
            name="sortOrder"
            type="number"
            step="1"
            defaultValue={fund?.sortOrder ?? '0'}
            hint="Lower numbers appear first."
          />
          <div className="flex items-end pb-2">
            <Checkbox
              label="Active"
              description="Inactive funds are hidden from donors and donate links."
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <Checkbox
            label="Show public progress"
            description="Allow the raised / goal progress bar to be embedded on lighthousecare.org.au. Turn off to hide the total without affecting giving."
            checked={showPublicProgress}
            onCheckedChange={(v) => setShowPublicProgress(v === true)}
          />
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-4">
          <Checkbox
            label="Feature as an appeal on the donor dashboard"
            description="Shows this fund as an appeal card (with its raised / goal progress) on the donor dashboard."
            checked={showOnDashboard}
            onCheckedChange={(v) => setShowOnDashboard(v === true)}
          />
          <Input
            label="Appeal tagline"
            name="tagline"
            defaultValue={fund?.tagline}
            placeholder="e.g. Christmas gifts for kids who’d go without."
            hint="Optional. A short line shown on the appeal card."
          />
          <Input
            label="Appeal image URL"
            name="imageUrl"
            defaultValue={fund?.imageUrl}
            placeholder="https://…"
            hint="Optional. Image shown on the appeal card."
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="depositAccount" className="text-sm font-medium text-gray-700">
              Deposit gifts to
            </label>
            <select
              id="depositAccount"
              name="depositAccount"
              defaultValue={fund?.depositAccount ?? 'CARE'}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="CARE">Lighthouse Care</option>
              <option value="CHURCH">Lighthouse Church</option>
            </select>
            <p className="text-xs text-gray-500">
              Which Stripe account (and bank) this fund&rsquo;s donations settle to.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create fund'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/funds')}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
