'use client'

import * as React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AUDIENCE_HINTS,
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  describeAudienceRule,
  type AudienceKind,
  type AudienceRule,
} from '@/lib/audience-core'

/**
 * Who a story or an event is for.
 *
 * Two controls, because there are two questions and conflating them is what
 * made "church only" also slam the door on the link. The list decides whose
 * dashboard it appears on. The choice below decides what somebody already
 * holding the link gets — and "unlisted" is the common case: promoted to one
 * group, forwarded to everybody.
 *
 * "Everyone" sits above the list rather than in it. Ticking all five audiences
 * is not the same as public: every one of them requires an account, so a
 * tick-everything would quietly make an event *less* visible than leaving it
 * alone. Keeping public separate makes that impossible to do by accident.
 *
 * Shoppers and Santa's Little Helpers are not here. Both are real audiences,
 * and neither is something the database can answer yet — a tickbox that
 * silently matches nobody is worse than no tickbox.
 */
export function AudiencePicker({
  value,
  onChange,
  canBePublic,
  showGate = canBePublic,
  publicLabel = 'Everyone — show it to anybody, signed in or not',
  publicHint = 'It appears for everyone and the link is open.',
}: {
  value: AudienceRule
  onChange: (rule: AudienceRule) => void
  /** Events can be public. Stories cannot — there is no public story page. */
  canBePublic: boolean
  /**
   * Whether to offer the link behaviour. Stories have no page of their own, so
   * there is no link for anybody to open and the question does not arise.
   */
  showGate?: boolean
  publicLabel?: string
  publicHint?: string
}) {
  const set = (patch: Partial<AudienceRule>) => onChange({ ...value, ...patch })

  const toggle = (kind: AudienceKind, on: boolean) => {
    const kinds = on ? [...value.kinds, kind] : value.kinds.filter((k) => k !== kind)
    // Choosing an audience narrows the listing; it says nothing about the link,
    // so the gate is left exactly as it was.
    set({ kinds, public: kinds.length > 0 ? false : value.public })
  }

  const allOn = value.kinds.length === AUDIENCE_KINDS.length
  const restricted = !value.public

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">Whose dashboard does this appear on?</p>

      {canBePublic && (
        <div className="mt-3">
          <Checkbox
            label={publicLabel}
            description={publicHint}
            checked={value.public && value.kinds.length === 0}
            onCheckedChange={(v) => set({ public: v === true, kinds: v === true ? [] : value.kinds })}
          />
        </div>
      )}

      <div className={canBePublic ? 'mt-4 border-t border-gray-100 pt-4' : 'mt-3'}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {canBePublic ? 'Or only these people' : 'Who this is for'}
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-orange-600 hover:underline"
            onClick={() =>
              allOn ? set({ kinds: [] }) : set({ kinds: [...AUDIENCE_KINDS], public: false })
            }
          >
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <div className="space-y-2.5">
          {AUDIENCE_KINDS.map((kind) => (
            <Checkbox
              key={kind}
              label={AUDIENCE_LABELS[kind]}
              description={AUDIENCE_HINTS[kind]}
              checked={value.kinds.includes(kind)}
              onCheckedChange={(v) => toggle(kind, v === true)}
            />
          ))}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {value.kinds.length === 0 && !value.public
            ? 'Nobody chosen, so it appears for anyone signed in.'
            : value.kinds.length > 1 && value.match === 'ANY'
              ? 'Anyone in one or more of these. Most people are in several.'
              : null}
        </p>

        {value.match === 'ALL' && value.kinds.length > 1 && (
          <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
            This one is set to people who are <strong>all</strong> of the above at once — a narrower
            rule from before this picker existed. Changing the ticks above will widen it to anyone
            in any of them.
          </p>
        )}
      </div>

      {showGate && restricted && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            If somebody outside that opens the link
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Separate from the list above, which only decides whose dashboard it appears on.
          </p>
          <div className="mt-2 space-y-2">
            <GateChoice
              checked={value.gate === 'SHOW'}
              onSelect={() => set({ gate: 'SHOW' })}
              title="They can open it"
              hint="The link works for anyone, signed in or not. It still never appears on their dashboard. Right for an event you promote to one group and expect to be forwarded."
            />
            <GateChoice
              checked={value.gate === 'ASK'}
              onSelect={() => set({ gate: 'ASK' })}
              title="They are asked to sign in"
              hint="They see the name and a prompt to sign in or create an account. The details, photo and tickets stay hidden until they do."
            />
            <GateChoice
              checked={value.gate === 'HIDE'}
              onSelect={() => set({ gate: 'HIDE' })}
              title="Nothing — a not-found page"
              hint="Not even the name, and no link preview. Use this when the fact that it exists is not public."
            />
          </div>
        </div>
      )}

      <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        <span className="font-semibold text-gray-900">
          {describeAudienceRule(value)}
        </span>
        {showGate && restricted ? (
          <>
            {value.kinds.length > 0 ? ' see it on their dashboard' : ' can see it'}
            {value.gate === 'SHOW'
              ? ', and anyone with the link can open it.'
              : value.gate === 'HIDE'
                ? '. Everybody else gets a not-found page.'
                : '. Everybody else is asked to sign in first.'}
          </>
        ) : null}
      </p>
    </div>
  )
}

function GateChoice({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${
        checked ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <span
        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
          checked ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
        }`}
        aria-hidden
      />
      <span>
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>
      </span>
    </button>
  )
}
