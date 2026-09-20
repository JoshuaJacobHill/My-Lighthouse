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
 * Two controls, not one, because they answer different questions. The list says
 * *who*; the refusal below says what everybody else gets. Folding the second
 * into the first would lose a real editorial decision — whether a stranger may
 * know the thing exists at all.
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
  publicLabel = 'Everyone, including people who are not signed in',
  publicHint = 'The event page is readable by anyone with the link.',
}: {
  value: AudienceRule
  onChange: (rule: AudienceRule) => void
  /** Events can be public. Stories cannot — there is no public story page. */
  canBePublic: boolean
  publicLabel?: string
  publicHint?: string
}) {
  const set = (patch: Partial<AudienceRule>) => onChange({ ...value, ...patch })

  const toggle = (kind: AudienceKind, on: boolean) => {
    const kinds = on ? [...value.kinds, kind] : value.kinds.filter((k) => k !== kind)
    // Choosing an audience means it is no longer for everyone.
    set({ kinds, public: kinds.length > 0 ? false : value.public })
  }

  const allOn = value.kinds.length === AUDIENCE_KINDS.length
  const restricted = !value.public

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">Who can see this?</p>

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
            ? 'Nobody chosen, so anyone signed in can see it.'
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

      {restricted && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Everybody else sees
          </p>
          <div className="mt-2 space-y-2">
            <GateChoice
              checked={value.gate === 'ASK'}
              onSelect={() => set({ gate: 'ASK' })}
              title="A prompt to sign in"
              hint="They see the name and are asked to sign in or create an account. Right for a link you have emailed — a not-found page would look broken to the people you sent it to."
            />
            <GateChoice
              checked={value.gate === 'HIDE'}
              onSelect={() => set({ gate: 'HIDE' })}
              title="A not-found page"
              hint="Nothing at all, not even the name. Use this when the fact that it exists is not public."
            />
          </div>
        </div>
      )}

      <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        <span className="font-semibold text-gray-900">{describeAudienceRule(value)}</span>
        {restricted && value.kinds.length > 0
          ? value.gate === 'HIDE'
            ? ' — everyone else gets a not-found page.'
            : ' — everyone else is asked to sign in.'
          : null}
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
