'use client'

import { Loader2, X } from 'lucide-react'

/**
 * The bar that appears once rows are selected.
 *
 * Sticky at the bottom rather than floating at the top, because the thing you
 * are acting on is the list you just scrolled through, and an action bar that
 * scrolls away from its own selection is how people lose track of what is
 * ticked.
 *
 * Always says how many. "Assign" is a different decision to "assign 38".
 */
export function BulkBar({
  count,
  noun,
  onClear,
  busy,
  children,
}: {
  count: number
  noun: string
  onClear: () => void
  busy?: boolean
  children: React.ReactNode
}) {
  if (count === 0) return null

  return (
    <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-full bg-neutral-950 py-2.5 pl-5 pr-2.5 text-white shadow-lg">
      <b className="mr-auto text-sm">
        {count} {count === 1 ? noun : `${noun}s`} selected
      </b>
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="rounded-full p-2 text-white/60 hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function BulkButton({
  onClick,
  disabled,
  tone = 'plain',
  children,
}: {
  onClick: () => void
  disabled?: boolean
  tone?: 'plain' | 'danger'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-[13px] font-bold disabled:opacity-40 ${
        tone === 'danger'
          ? 'bg-[#c8102e] text-white hover:bg-[#9d0b23]'
          : 'bg-white/15 text-white hover:bg-white/25'
      }`}
    >
      {children}
    </button>
  )
}

/** The tick on a row. Its own component so every list uses the same one. */
export function RowTick({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors ${
        checked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-transparent'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
