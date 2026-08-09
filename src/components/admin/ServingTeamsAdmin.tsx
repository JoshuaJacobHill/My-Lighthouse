'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { createServingTeamAction, setServingTeamActiveAction } from '@/lib/actions/team.actions'

interface TeamRow {
  id: string
  name: string
  description: string | null
  isActive: boolean
  interests: { id: string; userId: string; name: string; email: string; when: string }[]
}

export function ServingTeamsAdmin({ teams }: { teams: TeamRow[] }) {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function add() {
    if (!name.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await createServingTeamAction({ name, description })
      if (!res.success) {
        setError(res.error ?? 'Could not add team.')
        return
      }
      setName('')
      setDescription('')
      router.refresh()
    })
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await setServingTeamActiveAction(id, active)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Add team */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Plus className="h-4 w-4 text-orange-500" /> Add a team
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={add}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Teams */}
      {teams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No teams yet.
        </p>
      ) : (
        teams.map((t) => (
          <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold text-gray-900">
                  {t.name}
                  {!t.isActive && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Hidden</span>
                  )}
                </p>
                {t.description && <p className="mt-0.5 text-sm text-gray-500">{t.description}</p>}
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <Users className="h-3.5 w-3.5" /> {t.interests.length} interested
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(t.id, !t.isActive)}
                disabled={pending}
                className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t.isActive ? 'Hide' : 'Show'}
              </button>
            </div>

            {t.interests.length > 0 && (
              <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {t.interests.map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <Link href={`/admin/users/${i.userId}`} className="font-medium text-gray-900 hover:text-orange-600">
                      {i.name}
                      <span className="ml-2 text-xs font-normal text-gray-400">{i.email}</span>
                    </Link>
                    <span className="text-xs text-gray-400">{i.when}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
