'use client'

import * as React from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { setBusinessReportsAction } from '@/lib/actions/team.actions'

/**
 * Give one person the sales and marketing report.
 *
 * On its own, away from the staff and trainee flags, because it is a different
 * kind of decision: store revenue, ad spend and what every campaign returned.
 * A toggle sitting in a row with "trainee" invites being flicked in passing.
 *
 * Only a super admin sees it — the action enforces that too, and would refuse
 * anyone else — so for everybody else this renders nothing at all rather than
 * a disabled control that reads as something they are missing out on.
 */
export function BusinessReportsToggle({
  userId,
  name,
  canView,
}: {
  userId: string
  name: string
  canView: boolean
}) {
  const [on, setOn] = React.useState(canView)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState('')

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-gray-400">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Sales and marketing report</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">
              Store takings for both shops, online orders, ad spend and what each campaign
              returned. {on ? `${name} can see all of it.` : `${name} cannot see any of it.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          aria-pressed={on}
          onClick={() => {
            const next = !on
            setError('')
            setOn(next)
            startTransition(async () => {
              const res = await setBusinessReportsAction(userId, next)
              if (!res.success) {
                setOn(!next)
                setError(res.error ?? 'That did not work.')
              }
            })
          }}
          className={
            'inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ' +
            (on
              ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50')
          }
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          )}
          {on ? 'Can see the reports' : 'Give access'}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
    </div>
  )
}
