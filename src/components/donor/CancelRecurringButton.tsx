'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { cancelMyRecurringGift } from '@/lib/actions/recurring.actions'

export function CancelRecurringButton({
  id,
  account,
  label,
}: {
  id: string
  account: 'CARE' | 'CHURCH'
  label: string
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function handleCancel() {
    if (!confirm(`Cancel your ${label} recurring gift? This stops any future payments — already-made gifts aren’t affected.`)) {
      return
    }
    setBusy(true)
    const res = await cancelMyRecurringGift(id, account)
    if (res.success) {
      router.refresh()
    } else {
      alert(res.error ?? 'Could not cancel. Please try again.')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={busy}
      className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? 'Cancelling…' : 'Cancel'}
    </button>
  )
}
