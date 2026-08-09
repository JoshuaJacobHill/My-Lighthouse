'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Church } from 'lucide-react'
import { setChurchMemberAction } from '@/lib/actions/team.actions'

export function ChurchMemberToggle({ userId, initial }: { userId: string; initial: boolean }) {
  const router = useRouter()
  const [on, setOn] = React.useState(initial)
  const [pending, startTransition] = React.useTransition()

  function toggle() {
    const next = !on
    setOn(next)
    startTransition(async () => {
      const res = await setChurchMemberAction(userId, next)
      if (!res.success) setOn(!next)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ' +
        (on
          ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50')
      }
      aria-pressed={on}
    >
      <Church className="h-4 w-4" />
      {on ? 'Church member' : 'Mark as church member'}
    </button>
  )
}
