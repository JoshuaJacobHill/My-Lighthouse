'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Link2, RotateCw, X } from 'lucide-react'
import { createFamilyLinkAction, revokeFamilyLinkAction } from '@/lib/actions/slh.actions'

/**
 * The link an organisation sends a family so they can write the lists
 * themselves.
 *
 * One per family, covering every child on it — a parent with three children
 * should not be sent three links and left wondering whether they did the
 * middle one.
 *
 * The address is the whole of its security, so the copy says what that means
 * plainly: anybody holding it can fill in these lists. Replacing it is the
 * revoke, and it is one tap, because "I sent it to the wrong number" is a
 * thing that happens.
 */
export function FamilyLink({
  familyId,
  token,
  openedAt,
}: {
  familyId: string
  token: string | null
  /** When the family last opened it — the cue to chase, or not. */
  openedAt: string | null
}) {
  const router = useRouter()
  const [url, setUrl] = useState(token ? `/wishlist/${token}` : null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const full = url ? `${typeof window === 'undefined' ? '' : window.location.origin}${url}` : null

  function make() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('familyId', familyId)
      const result = await createFamilyLinkAction(fd)
      if (result.success && result.url) {
        setUrl(result.url)
        setCopied(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not make that link.')
      }
    })
  }

  function revoke() {
    if (!window.confirm('Withdraw this link? It stops working immediately.')) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('familyId', familyId)
      const result = await revokeFamilyLinkAction(fd)
      if (result.success) {
        setUrl(null)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not withdraw that link.')
      }
    })
  }

  if (!url) {
    return (
      <div className="mt-2.5">
        <button
          type="button"
          onClick={make}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 py-1.5 text-[13px] font-bold hover:bg-neutral-50 disabled:opacity-50"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          {pending ? 'Making…' : 'Get a link for this family'}
        </button>
        {error && (
          <p role="alert" className="mt-1.5 text-[13px] font-semibold text-[#c8102e]">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2.5 rounded-2xl bg-neutral-50 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-[12px] text-neutral-600">
          {full}
        </code>
        <button
          type="button"
          onClick={async () => {
            if (!full) return
            try {
              await navigator.clipboard.writeText(full)
              setCopied(true)
            } catch {
              setError('Could not copy — select the address and copy it by hand.')
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-neutral-700"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        {openedAt
          ? `They last opened it ${openedAt}.`
          : 'Not opened yet. Send it by text or email — anybody holding this address can fill in these lists, so treat it like a password.'}
      </p>

      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={make}
          disabled={pending}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> New link
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-400 hover:text-[#c8102e]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" /> Withdraw
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-semibold text-[#c8102e]">
          {error}
        </p>
      )}
    </div>
  )
}
