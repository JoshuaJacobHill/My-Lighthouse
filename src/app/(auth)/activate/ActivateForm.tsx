'use client'

import * as React from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Check, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { requestActivationLinkAction } from '@/lib/actions/activate.actions'

const PERKS = [
  'See your giving history and download tax-deductible receipts',
  'Manage regular giving and update your details securely',
  'Find volunteering and corporate team days',
  'Hear about events and appeals first',
]

export function ActivateForm() {
  const [email, setEmail] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)
  const [error, setError] = React.useState('')
  const [isPending, startTransition] = React.useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const res = await requestActivationLinkAction({ email })
      if (res.success) setSubmitted(true)
      else setError(res.error ?? 'Something went wrong. Please try again.')
    })
  }

  if (submitted) {
    return (
      <div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-6 py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white">
            <MailCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-orange-800">
            We&rsquo;ve sent a link to <strong>{email}</strong>. Click it to finish setting up your account.
          </p>
          <p className="mt-3 text-xs text-orange-700">
            Can&rsquo;t find it? Check your junk folder, or{' '}
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="font-semibold underline"
            >
              try another email address
            </button>
            .
          </p>
        </div>
        <div className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-orange-500 hover:underline">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Activate your account</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          The My Lighthouse Portal is the online home for our supporters. Enter your email and we&rsquo;ll send
          you a link to set your password.
        </p>
      </div>

      <ul className="mb-7 space-y-2">
        {PERKS.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          autoFocus
          hint="Use the email you give or volunteer with, and we’ll bring your history across."
        />

        {error && (
          <div
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send my activation link'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        Already set up?{' '}
        <Link href="/login" className="font-medium text-orange-500 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
