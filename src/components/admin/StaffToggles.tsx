'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, GraduationCap } from 'lucide-react'
import { setStaffAction, setTraineeAction } from '@/lib/actions/team.actions'

/**
 * Marks a user as staff and/or trainee. Deliberately flags rather than roles —
 * staff are often volunteers and donors too, and must keep those capabilities.
 */
function Toggle({
  on,
  label,
  labelOff,
  icon: Icon,
  onToggle,
}: {
  on: boolean
  label: string
  labelOff: string
  icon: React.ElementType
  onToggle: (next: boolean) => Promise<boolean>
}) {
  const [state, setState] = React.useState(on)
  const [pending, startTransition] = React.useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={state}
      onClick={() => {
        const next = !state
        setState(next)
        startTransition(async () => {
          const ok = await onToggle(next)
          if (!ok) setState(!next)
        })
      }}
      className={
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ' +
        (state
          ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50')
      }
    >
      <Icon className="h-4 w-4" />
      {state ? label : labelOff}
    </button>
  )
}

export function StaffToggles({
  userId,
  isStaff,
  isTrainee,
}: {
  userId: string
  isStaff: boolean
  isTrainee: boolean
}) {
  const router = useRouter()
  return (
    <>
      <Toggle
        on={isStaff}
        label="Staff"
        labelOff="Mark as staff"
        icon={Briefcase}
        onToggle={async (next) => {
          const res = await setStaffAction(userId, next)
          router.refresh()
          return res.success
        }}
      />
      <Toggle
        on={isTrainee}
        label="Trainee"
        labelOff="Mark as trainee"
        icon={GraduationCap}
        onToggle={async (next) => {
          const res = await setTraineeAction(userId, next)
          router.refresh()
          return res.success
        }}
      />
    </>
  )
}
