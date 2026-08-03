'use client'

import * as React from 'react'
import { useState, FormEvent, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    startTransition(async () => {
      try {
        await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        // Always show success — never reveal whether the email exists
        setSubmitted(true)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Forgot your password?</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-5 py-5 text-center">
          <p className="text-sm font-medium text-orange-800">Check your inbox</p>
          <p className="text-sm text-orange-700 mt-1">
            If that email is registered, you&apos;ll receive a password reset link shortly.
          </p>
        </div>
      ) : (
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

          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-red-600"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-orange-500 hover:underline">
          &larr; Back to sign in
        </Link>
      </div>
    </div>
  )
}
