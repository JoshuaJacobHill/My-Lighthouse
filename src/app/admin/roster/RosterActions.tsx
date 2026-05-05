'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { EditShiftModal } from './EditShiftModal'

interface Location {
  id: string
  name: string
}

interface Department {
  id: string
  name: string
}

interface ShiftData {
  id: string
  date: string | Date
  startTime: string | Date
  endTime: string | Date
  locationId: string
  departmentId: string | null
  title: string | null
  capacity: number
  notes: string | null
}

interface RosterActionsProps {
  shift: ShiftData
  locations: Location[]
  departments: Department[]
}

export function RosterActions({ shift, locations, departments }: RosterActionsProps) {
  const router = useRouter()
  const [deleting, setDeleting] = React.useState(false)

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this shift? This cannot be undone.')) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/shifts/${shift.id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (result.success) {
        router.refresh()
      } else {
        alert(result.error ?? 'Failed to delete shift.')
      }
    } catch {
      alert('Something went wrong.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <EditShiftModal shift={shift} locations={locations} departments={departments} />
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
        aria-label="Delete shift"
        title="Delete shift"
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}
