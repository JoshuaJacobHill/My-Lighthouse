'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { deleteStoryAction } from '@/lib/actions/story.actions'

export function DeleteStoryButton({ storyId, title }: { storyId: string; title: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  async function handleDelete() {
    if (!confirm(`Delete “${title}”? This can’t be undone.`)) return
    setBusy(true)
    const res = await deleteStoryAction(storyId)
    if (res.success) {
      router.refresh()
    } else {
      alert(res.error ?? 'Could not delete the story.')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  )
}
