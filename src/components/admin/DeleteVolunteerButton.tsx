'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Props {
  volunteerId: string
  volunteerName: string
  /** Where to redirect after deletion. Defaults to /admin/volunteers */
  redirectTo?: string
  /** Visual variant */
  variant?: 'button' | 'icon'
}

export function DeleteVolunteerButton({
  volunteerId,
  volunteerName,
  redirectTo = '/admin/volunteers',
  variant = 'button',
}: Props) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/volunteers/${volunteerId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to delete volunteer')
      }
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          title="Delete volunteer"
          className="inline-flex items-center rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete Volunteer
        </button>
      )}

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete volunteer?</h2>
            <p className="text-sm text-gray-600 mb-1">
              You are about to permanently delete{' '}
              <span className="font-semibold">{volunteerName}</span> and all of their
              records — attendance, shifts, notes, and emails.
            </p>
            <p className="text-sm font-medium text-red-600 mb-5">
              This cannot be undone.
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
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Yes, delete permanently
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
