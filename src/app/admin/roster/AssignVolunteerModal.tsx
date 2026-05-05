'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Loader2, Search } from 'lucide-react'

interface Volunteer {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface CurrentAssignment {
  volunteerId: string
  status: string
}

interface AssignVolunteerModalProps {
  shiftId: string
  assignedCount: number
  capacity: number
  currentAssignments: CurrentAssignment[]
}

export function AssignVolunteerModal({
  shiftId,
  assignedCount,
  capacity,
  currentAssignments,
}: AssignVolunteerModalProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<Volunteer[]>([])
  const [searching, setSearching] = React.useState(false)
  const [assigning, setAssigning] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const isFull = assignedCount >= capacity

  // IDs of volunteers already actively assigned
  const activeAssignmentIds = new Set(
    currentAssignments
      .filter((a) => a.status !== 'ADMIN_CANCELLED' && a.status !== 'CANCELLED_BY_VOLUNTEER')
      .map((a) => a.volunteerId)
  )

  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setError(null)
    setSuccess(null)

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (val.trim().length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/volunteers/search?q=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        setResults(data.volunteers ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  async function handleAssign(volunteer: Volunteer) {
    setError(null)
    setSuccess(null)
    setAssigning(volunteer.id)

    try {
      const res = await fetch(`/api/admin/shifts/${shiftId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId: volunteer.id }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? 'Failed to assign volunteer.')
      } else {
        setSuccess(`${volunteer.firstName} ${volunteer.lastName} assigned successfully.`)
        setQuery('')
        setResults([])
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setAssigning(null)
    }
  }

  function handleClose() {
    setOpen(false)
    setQuery('')
    setResults([])
    setError(null)
    setSuccess(null)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={isFull}
        title={isFull ? 'Shift is at full capacity' : 'Assign a volunteer to this shift'}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Assign
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Assign Volunteer</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            {assignedCount}/{capacity} volunteers assigned. Search to add another.
          </p>

          {isFull && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              This shift is at full capacity ({capacity}/{capacity}).
            </div>
          )}

          {!isFull && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Search by name or email…"
                  autoFocus
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                )}
              </div>

              {results.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden max-h-60 overflow-y-auto">
                  {results.map((vol) => {
                    const alreadyAssigned = activeAssignmentIds.has(vol.id)
                    return (
                      <li key={vol.id}>
                        <button
                          onClick={() => !alreadyAssigned && handleAssign(vol)}
                          disabled={alreadyAssigned || assigning === vol.id}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-orange-50 disabled:opacity-60 disabled:cursor-default transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {vol.firstName} {vol.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{vol.email}</p>
                          </div>
                          {alreadyAssigned ? (
                            <span className="text-xs text-green-600 font-medium">Assigned</span>
                          ) : assigning === vol.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                          ) : (
                            <span className="text-xs text-orange-500 font-medium">Add</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {query.trim().length >= 2 && !searching && results.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">No volunteers found.</p>
              )}
            </>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
