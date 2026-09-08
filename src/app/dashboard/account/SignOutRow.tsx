'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'

/** Sign out, styled to match the rows around it. */
export function SignOutRow() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await fetch('/api/auth/signout', { method: 'POST' })
        router.push('/login')
      }}
      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-red-50 disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
      <span className="font-semibold text-neutral-900">Log out</span>
    </button>
  )
}
