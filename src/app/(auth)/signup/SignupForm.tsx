'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, MailCheck, ArrowLeft, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkSignupEmailAction, createAccountAction } from '@/lib/actions/signup.actions'

type Step = 'email' | 'existing_account' | 'link_sent' | 'details'

export function SignupForm() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>('email')
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [company, setCompany] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [isPending, startTransition] = React.useTransition()

  function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const res = await checkSignupEmailAction({ email })
      if (!res.success) return setError(res.error ?? 'Something went wrong. Please try again.')
      if (res.mode === 'new') setStep('details')
      else if (res.mode === 'existing_account') setStep('existing_account')
      else setStep('link_sent')
    })
  }

  function submitDetails(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const res = await createAccountAction({ email, name, company, password })
      if (!res.success) return setError(res.error ?? 'Something went wrong. Please try again.')
      router.push(res.redirectTo ?? '/dashboard')
      router.refresh()
    })
  }

  // ── They already have a full account — just point them at signing in ──
  if (step === 'existing_account') {
    return (
      <div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white">
            <UserCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">You already have an account</h1>
          <p className="mt-2 text-sm text-gray-600">
            <strong>{email}</strong> is already set up. Sign in to pick up where you left off.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600"
          >
            Sign in
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            Forgotten your password?{' '}
            <Link href="/forgot-password" className="font-semibold text-orange-500 hover:underline">
              Reset it here
            </Link>
          </p>
        </div>
        <div className="mt-6 text-center text-sm text-gray-500">
          <button type="button" onClick={() => setStep('email')} className="font-medium text-orange-500 hover:underline">
            &larr; Use a different email
          </button>
        </div>
      </div>
    )
  }

  // ── We've emailed them a link (existing supporter, no password yet) ──
  if (step === 'link_sent') {
    return (
      <div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-6 py-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white">
            <MailCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-orange-800">
            We&rsquo;ve sent a link to <strong>{email}</strong>. Click it to finish setting up your account — your
            history will be waiting for you.
          </p>
          <p className="mt-3 text-xs text-orange-700">
            Can&rsquo;t find it? Check your junk folder, or{' '}
            <button type="button" onClick={() => setStep('email')} className="font-semibold underline">
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

  // ── Brand new email — finish signing up on the spot ──
  if (step === 'details') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setStep('email')}
          className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Create your account</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Signing up as <strong className="text-gray-700">{email}</strong>
          </p>
        </div>

        <form onSubmit={submitDetails} noValidate className="space-y-5">
          <Input
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            autoFocus
            maxLength={120}
          />
          <Input
            label="Company / organisation"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Optional"
            maxLength={160}
            hint="If you're signing up on behalf of a workplace, add it here."
          />
          <Input
            label="Choose a password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            hint="At least 8 characters."
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Creating your account…
              </>
            ) : (
              'Create my account'
            )}
          </Button>
        </form>
      </div>
    )
  }

  // ── Step one: email ──
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sign up</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          The My Lighthouse Portal is the online home for our supporters — give, volunteer and see your impact in one
          place.
        </p>
      </div>

      <form onSubmit={submitEmail} noValidate className="space-y-5">
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
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
            </>
          ) : (
            'Next'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-orange-500 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
