'use client'

import { useMemo } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { emailHint } from '@/lib/email-hint'

/**
 * An email box that checks itself as you type.
 *
 * The suggestion is a **button**, not a warning to retype something. Somebody
 * who has just mistyped their own address is not well placed to spot the
 * difference between gmial and gmail on a second reading, so the fix is one
 * tap and the corrected address is shown in full.
 *
 * Nothing here blocks a save. An unusual domain is somebody's real address,
 * and refusing it would turn away the person we are trying to help; only
 * sending mail proves an address works.
 */
export function EmailField({
  id,
  value,
  onChange,
  label,
  placeholder = 'Email address',
  className,
  describe,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  className?: string
  /** Extra note under the field, when there is nothing to correct. */
  describe?: string
}) {
  const hint = useMemo(() => emailHint(value), [value])
  const messageId = `${id}-hint`

  return (
    <div>
      {label && (
        <label className="block text-[13px] font-bold" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={hint.kind === 'quiet' ? undefined : messageId}
          aria-invalid={hint.kind === 'invalid' || undefined}
          className={
            className ??
            `mt-1.5 w-full rounded-2xl border px-4 py-3 pr-11 text-base focus:outline-none ${
              hint.kind === 'invalid'
                ? 'border-[#c8102e] focus:border-[#c8102e]'
                : 'border-neutral-200 focus:border-neutral-400'
            }`
          }
        />
        {hint.kind === 'ok' && (
          <Check
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600"
            aria-hidden="true"
          />
        )}
        {hint.kind === 'invalid' && (
          <AlertCircle
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c8102e]"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Polite, not assertive: this updates on every keystroke, and a screen
          reader interrupting each one would be unusable. */}
      <p id={messageId} role="status" aria-live="polite" className="mt-1.5 text-xs">
        {hint.kind === 'invalid' ? (
          <span className="font-semibold text-[#c8102e]">{hint.message}</span>
        ) : hint.kind === 'suggestion' ? (
          <button
            type="button"
            onClick={() => onChange(hint.suggestion)}
            className="font-semibold text-[#c8102e] underline underline-offset-2 hover:text-[#9d0b23]"
          >
            {hint.message} Tap to use it.
          </button>
        ) : (
          <span className="text-neutral-400">{describe ?? ''}</span>
        )}
      </p>
    </div>
  )
}
