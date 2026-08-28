'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Plus, Check, Clock, X, AlertCircle } from 'lucide-react'
import {
  addEmailAction,
  resendEmailVerificationAction,
  removeEmailAction,
} from '@/lib/actions/user-emails.actions'

export interface LinkedEmail {
  id: string
  email: string
  verified: boolean
}

/**
 * Managing the extra addresses on an account.
 *
 * The point of it is stated plainly at the top, because "add another email" on
 * its own doesn't tell anyone why they'd bother.
 */
export function LinkedEmails({ primary, emails }: { primary: string; emails: LinkedEmail[] }) {
  const router = useRouter()
  const [adding, setAdding] = React.useState(false)
  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [pending, startTransition] = React.useTransition()

  function run(fn: () => Promise<{ success: boolean; error?: string; message?: string }>, onDone?: () => void) {
    setError('')
    setNotice('')
    startTransition(async () => {
      const res = await fn()
      if (!res.success) return setError(res.error ?? 'Something went wrong. Please try again.')
      setNotice(res.message ?? '')
      onDone?.()
      router.refresh()
    })
  }

  return (
    <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold tracking-tight text-gray-900">Your email addresses</h2>
      <p className="mt-1 text-sm text-gray-500">
        If you&rsquo;ve given using a different address &mdash; a personal one, or an old work one &mdash; add it here
        and we&rsquo;ll bring that giving into your history.
      </p>

      <ul className="mt-5 divide-y divide-gray-100">
        <li className="flex items-center gap-3 py-3">
          <Mail className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{primary}</span>
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            Main
          </span>
        </li>

        {emails.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3">
            <Mail className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{e.email}</span>
            {e.verified ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                <Check className="h-3 w-3" aria-hidden="true" /> Confirmed
              </span>
            ) : (
              <>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <Clock className="h-3 w-3" aria-hidden="true" /> Waiting
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => resendEmailVerificationAction(e.id))}
                  className="shrink-0 text-xs font-semibold text-orange-600 hover:underline disabled:opacity-50"
                >
                  Resend
                </button>
              </>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => removeEmailAction(e.id))}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              aria-label={`Remove ${e.email}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {notice && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {adding ? (
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => addEmailAction({ email: value }), () => {
              setValue('')
              setAdding(false)
            })
          }}
        >
          <input
            type="email"
            required
            autoFocus
            value={value}
            onChange={(ev) => setValue(ev.target.value)}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Send confirmation
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setError('')
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add another email
        </button>
      )}

      <p className="mt-4 text-xs text-gray-400">
        We&rsquo;ll send a link to any address you add &mdash; it only gets linked once you click it.
      </p>
    </div>
  )
}
