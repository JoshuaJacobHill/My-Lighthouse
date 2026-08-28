'use client'

import * as React from 'react'
import { Loader2, Send, Check, AlertCircle } from 'lucide-react'
import { sendAccountInviteAction } from '@/lib/actions/admin.actions'

/**
 * Invite (or re-invite) someone whose account exists but who has never been
 * given a way in. Shown prominently when there's no password on the account,
 * quietly otherwise.
 */
export function SendInviteButton({ userId, hasPassword }: { userId: string; hasPassword: boolean }) {
  const [state, setState] = React.useState<'idle' | 'sent' | 'error'>('idle')
  const [message, setMessage] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  function send() {
    startTransition(async () => {
      const res = await sendAccountInviteAction(userId)
      if (!res.success) {
        setState('error')
        setMessage(res.error ?? 'Could not send that.')
        return
      }
      setState('sent')
      setMessage(`Invite sent to ${res.sentTo}.`)
    })
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${hasPassword ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50'}`}
    >
      {!hasPassword && (
        <p className="mb-2 text-sm font-semibold text-amber-800">
          This person hasn&rsquo;t set a password yet — they can&rsquo;t sign in.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" /> {hasPassword ? 'Resend' : 'Send'} set-password invite
            </>
          )}
        </button>
        {state === 'sent' && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
            <Check className="h-4 w-4" aria-hidden="true" /> {message}
          </span>
        )}
        {state === 'error' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" aria-hidden="true" /> {message}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">The link works for 7 days and replaces any earlier one.</p>
    </div>
  )
}
