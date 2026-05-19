'use client'

import * as React from 'react'
import { loginAction } from '@/lib/actions/auth.actions'
import { Button } from '@/components/ui/button'
import { Heart, Loader2 } from 'lucide-react'

export default function KioskLoginPage() {
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await loginAction(formData)
      if (result.success) {
        // Hard redirect so iOS Safari picks up the new session cookie
        // before the next server render runs the auth check
        window.location.href = '/kiosk'
      } else {
        setError(result.error ?? 'Sign in failed. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 mb-4">
            <Heart className="h-10 w-10 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-white">Lighthouse Care</h1>
          <p className="mt-2 text-orange-200 text-lg">Volunteer Kiosk</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Sign in to the kiosk
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-base"
                placeholder="kiosk@lighthousecare.org.au"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-base"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            This kiosk is for volunteer check-in only.
          </p>
        </div>

        <p className="text-center text-sm text-orange-200 mt-6">
          Making lives better so that together we can make the world better.
        </p>
      </div>
    </div>
  )
}
