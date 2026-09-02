'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateDonorAccountAction, type UpdateDonorAccountInput } from '@/lib/actions/donor-account.actions'

export function AccountSettingsForm({
  initial,
}: {
  initial: { name: string; email: string; company: string; phone: string; address: string; consentEmailUpdates: boolean }
}) {
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const input: UpdateDonorAccountInput = {
      name: String(fd.get('name') ?? ''),
      company: String(fd.get('company') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      address: String(fd.get('address') ?? ''),
      consentEmailUpdates: fd.get('consentEmailUpdates') === 'on',
    }
    const res = await updateDonorAccountAction(input)
    setSaving(false)
    if (res.success) {
      setSaved(true)
    } else {
      setError(res.error ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Your details have been saved.
        </div>
      )}

      <Input label="Name" name="name" defaultValue={initial.name} required maxLength={120} />
      <Input
        label="Email"
        value={initial.email}
        disabled
        hint="Contact us if you need to change the email on your account."
      />
      <Input
        label="Company / organisation"
        name="company"
        defaultValue={initial.company}
        placeholder="Optional"
        maxLength={160}
        hint="If your workplace gives or volunteers with us, add it here to unlock corporate volunteering."
      />
      <Input label="Mobile" name="phone" defaultValue={initial.phone} placeholder="Optional" maxLength={40} />
      <Input label="Address" name="address" defaultValue={initial.address} placeholder="Optional" maxLength={300} />

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="consentEmailUpdates"
          defaultChecked={initial.consentEmailUpdates}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-sm text-gray-700">
          Keep me updated by email about Lighthouse Care&rsquo;s work and appeals.
        </span>
      </label>

      <div className="pt-1">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
