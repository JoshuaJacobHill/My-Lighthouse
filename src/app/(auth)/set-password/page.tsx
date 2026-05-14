'use client'

import * as React from 'react'
import { useState, FormEvent, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ─── Inner component — reads search params ────────────────────────────────────

function SetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!token) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-5 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-red-800">This link is invalid or has expired.</p>
        <p className="text-xs text-red-600 mt-1">
          Please contact your volunteer coordinator or{' '}
          <Link href="/forgot-password" className="underline font-medium">
            request a new link
          </Link>
          .
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm font-semibold text-green-800">Password set!</p>
        <p className="text-sm text-green-700 mt-1">You can now sign in with your new password.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
        >
          Sign In &rarr;
        </Link>
      </div>
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error ?? 'Something went wrong. Please try again.')
        } else {
          setSuccess(true)
        }
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Input
        label="New password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Minimum 8 characters"
        required
        autoComplete="new-password"
        autoFocus
      />
      <Input
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Re-enter your password"
        required
        autoComplete="new-password"
      />

      {error && (
        <div
          className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Setting password...
          </>
        ) : (
          'Set Password'
        )}
      </Button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SetPasswordPage() {
  return (
    <div className="p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Create your password</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose a password to activate your volunteer account.
        </p>
      </div>

      <Suspense fallback={null}>
        <SetPasswordForm />
      </Suspense>

      <div className="mt-6 text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-orange-500 hover:underline">
          &larr; Back to sign in
        </Link>
      </div>
    </div>
  )
}
