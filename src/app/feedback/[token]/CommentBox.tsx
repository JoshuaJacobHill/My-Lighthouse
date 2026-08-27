'use client'

import * as React from 'react'
import { Check, Loader2 } from 'lucide-react'
import { addFeedbackCommentAction } from '@/lib/actions/feedback.actions'

export function CommentBox({ token }: { token: string }) {
  const [comment, setComment] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  if (saved) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
        <Check className="h-4 w-4" /> Thanks — your coordinator will see this.
      </p>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!comment.trim()) return
        startTransition(async () => {
          const res = await addFeedbackCommentAction({ token, comment })
          if (res.success) setSaved(true)
        })
      }}
    >
      <label className="text-xs font-medium text-neutral-600">
        Anything you&rsquo;d like to add? (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Something that went well, or something we could do better…"
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending || !comment.trim()}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
      >
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Send'}
      </button>
    </form>
  )
}
