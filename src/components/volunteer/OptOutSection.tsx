'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, AlertTriangle } from 'lucide-react'
import { optOutAction } from '@/lib/actions/volunteer.actions'

export function OptOutSection() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleOptOut() {
    setLoading(true)
    setError(null)
    const result = await optOutAction()
    if (result.success) {
      // Redirect to a goodbye page / login. The session is still valid but
      // the volunteer portal will bounce them when it checks status.
      router.push('/login?goodbye=1')
    } else {
      setError(result.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Section trigger */}
      <div className="rounded-xl border border-red-100 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">Leave as a volunteer</h3>
            <p className="mt-1 text-sm text-red-700">
              If you&rsquo;d like to stop volunteering with Lighthouse Care, you can remove yourself here.
              We&rsquo;ll send you a farewell email and you&rsquo;ll be able to return any time by
              contacting us at{' '}
              <a
                href="mailto:volunteer@lighthousecare.org.au"
                className="underline font-medium"
              >
                volunteer@lighthousecare.org.au
              </a>
              .
            </p>
            <button
              onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Leave as a volunteer
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Are you sure?</h2>
            <p className="text-sm text-gray-600 mb-1">
              Leaving will remove your volunteer account. We&rsquo;ll send you a farewell email
              and your access to the portal will end.
            </p>
            <p className="text-sm text-gray-600 mb-5">
              You can always come back — just email us at{' '}
              <a
                href="mailto:volunteer@lighthousecare.org.au"
                className="font-medium text-orange-600 hover:underline"
              >
                volunteer@lighthousecare.org.au
              </a>
              .
            </p>

            {error && (
              <p className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setOpen(false); setError(null) }}
                disabled={loading}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Stay as a volunteer
              </button>
              <button
                onClick={handleOptOut}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Leaving…
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Yes, leave
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
