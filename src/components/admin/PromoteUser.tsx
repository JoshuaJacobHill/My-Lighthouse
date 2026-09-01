'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, ShieldCheck, AlertCircle, Check } from 'lucide-react'
import {
  searchUsersForRoleAction,
  setUserRoleAction,
  type UserSearchResult,
} from '@/lib/actions/admin.actions'
import { USER_ROLES, ASSIGNABLE_ADMIN_ROLES, ADMIN_ROLE_DESCRIPTIONS } from '@/lib/constants'

/**
 * Give someone who already has an account an admin role.
 *
 * Creating a fresh account was the only way in before, which meant an existing
 * volunteer or staff member had to be given a second login to become an admin.
 */
export function PromoteUser() {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<UserSearchResult[]>([])
  const [chosen, setChosen] = React.useState<UserSearchResult | null>(null)
  const [role, setRole] = React.useState<string>('ADMIN')
  const [giving, setGiving] = React.useState(false)
  const [error, setError] = React.useState('')
  const [done, setDone] = React.useState('')
  const [searching, startSearch] = React.useTransition()
  const [saving, startSave] = React.useTransition()

  // Search as they type, once there is enough to go on.
  React.useEffect(() => {
    if (chosen) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      startSearch(async () => setResults(await searchUsersForRoleAction(q)))
    }, 250)
    return () => clearTimeout(t)
  }, [query, chosen])

  function choose(u: UserSearchResult) {
    setChosen(u)
    setError('')
    setDone('')
    setRole(u.role === 'VOLUNTEER' ? 'ADMIN' : u.role)
    setGiving(u.canViewDonations)
  }

  function save() {
    if (!chosen) return
    setError('')
    startSave(async () => {
      const res = await setUserRoleAction(chosen.id, role, giving)
      if (!res.success) return setError(res.error ?? 'Could not save that.')
      setDone(`${chosen.name ?? chosen.email} is now ${USER_ROLES[role as keyof typeof USER_ROLES]}.`)
      setChosen(null)
      setQuery('')
      setResults([])
      router.refresh()
    })
  }

  const field =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none'

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
        <ShieldCheck className="h-4 w-4 text-gray-400" aria-hidden="true" /> Make an existing user an admin
      </h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Search for someone who already has an account and give them a role. They keep the same login.
      </p>

      {done && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          <Check className="h-4 w-4" aria-hidden="true" /> {done}
        </p>
      )}

      {!chosen ? (
        <>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className={`${field} pl-9`}
            />
            {searching && (
              <Loader2
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400"
                aria-hidden="true"
              />
            )}
          </div>

          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => choose(u)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {u.name ?? '(no name)'}
                      </span>
                      <span className="block truncate text-xs text-gray-500">{u.email}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {USER_ROLES[u.role as keyof typeof USER_ROLES] ?? u.role}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">No accounts match that.</p>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{chosen.name ?? '(no name)'}</p>
            <p className="text-xs text-gray-500">{chosen.email}</p>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`mt-1 bg-white ${field}`}>
              {ASSIGNABLE_ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLES[r]}
                </option>
              ))}
              <option value="VOLUNTEER">No admin access</option>
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              {ADMIN_ROLE_DESCRIPTIONS[role as keyof typeof ADMIN_ROLE_DESCRIPTIONS] ??
                'Removes admin access. Their account and history stay exactly as they are.'}
            </span>
          </label>

          {role === 'ADMIN' && (
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={giving}
                onChange={(e) => setGiving(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Can see donations and donors</span>
            </label>
          )}

          {error && (
            <p className="inline-flex items-start gap-1.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save role
            </button>
            <button
              type="button"
              onClick={() => {
                setChosen(null)
                setError('')
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
