'use client'

import * as React from 'react'
import { useState, FormEvent, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginAction } from '@/lib/actions/auth.actions'
import { safeNext } from '@/lib/safe-next'

function GoodbyeBanner() {
  const searchParams = useSearchParams()
  const goodbye = searchParams.get('goodbye') === '1'
  if (!goodbye) return null
  return (
    <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-4 text-center">
      <Heart className="h-6 w-6 text-orange-400 mx-auto mb-2" aria-hidden="true" />
      <p className="text-sm font-medium text-orange-800">Thank you for everything you&apos;ve done.</p>
      <p className="text-xs text-orange-600 mt-1">
        We&rsquo;ve sent you a farewell email. You&apos;re always welcome back —{' '}
        <a href="mailto:volunteer@lighthousecare.org.au" className="underline font-medium">
          get in touch
        </a>{' '}
        any time.
      </p>
    </div>
  )
}

/**
 * Where to go after signing in.
 *
 * `?next=` is set by pages that turned somebody away — a private event, for
 * instance — so they land back where they were headed instead of on the
 * dashboard wondering what happened. Validated by `safeNext`, because an
 * unchecked value here is an open redirect on the one page where somebody has
 * just typed a password.
 *
 * Admins and the kiosk keep the destination `loginAction` chose for them: an
 * admin signing in belongs in the admin area, whatever link brought them.
 */
function useNextDestination(): string | null {
  const params = useSearchParams()
  // `callbackUrl` is what the middleware used to send. Read as a fallback so
  // links already sitting in inboxes and browser histories still land right.
  return safeNext(params.get('next') ?? params.get('callbackUrl'))
}

/**
 * The form itself, separate from the default export purely so it can sit
 * inside a Suspense boundary. `useSearchParams` requires one — without it the
 * build fails at prerender with "should be wrapped in a suspense boundary",
 * which `tsc` does not catch.
 */
function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const next = useNextDestination()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', password)

    startTransition(async () => {
      const result = await loginAction(formData)
      if (result.error) {
        setError(result.error)
      }
      if (result.redirectTo) {
        // Only for ordinary supporters — an admin or kiosk sign-in keeps the
        // destination the action picked.
        const wanted = result.redirectTo === '/dashboard' ? next : null
        router.push(wanted ?? result.redirectTo)
      }
    })
  }

  return (
    <div>
      <Suspense fallback={null}>
        <GoodbyeBanner />
      </Suspense>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Sign In</h1>
      </div>

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
        <div>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-orange-500 hover:text-orange-600 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

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
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        New here?{' '}
        <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
            className="font-medium text-orange-500 hover:underline"
          >
          Sign up here &rarr;
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
