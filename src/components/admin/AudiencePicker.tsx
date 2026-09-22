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
 * Two questions, because they are genuinely separate and welding them together
 * is what made "church only" also slam the door on the link:
 *
 *   Private       may somebody open the link without signing in
 *   The audience  whose dashboard it appears on
 *
 * An event is open by default. Ticking Private requires an account to view it;
 * choosing an audience narrows whose dashboard lists it. GENERALZ is both at
 * once in the useful direction — listed to church members, link open to anyone
 * it gets forwarded to.
 *
 * There is no control for hiding an event's existence. That was the old
 * church-only 404, and leaving an event unpublished does the same job without a
 * second way to say it. `HIDE` survives in the data for rows that already carry
 * it; a row saved from this form becomes Private instead.
 *
 * Shoppers and Santa's Little Helpers are not in the list. Both are real
 * audiences, and neither is something the database can answer yet — a tickbox
 * that silently matches nobody is worse than no tickbox.
 */
export function AudiencePicker({
  value,
  onChange,
  canBePublic,
  showGate = canBePublic,
}: {
  value: AudienceRule
  onChange: (rule: AudienceRule) => void
  /** Events can be public. Stories cannot — there is no public story page. */
  canBePublic: boolean
  /**
   * Whether to ask about the link. Stories have no page of their own, so there
   * is nothing for anybody to open and the question does not arise.
   */
  showGate?: boolean
}) {
  const set = (patch: Partial<AudienceRule>) => onChange({ ...value, ...patch })

  // HIDE has no control any more, so it reads as private here. Saving turns it
  // into ASK, which shows the name rather than a 404 — a deliberate widening,
  // and the only one this form can perform.
  const isPrivate = value.gate !== 'SHOW'

  const toggle = (kind: AudienceKind, on: boolean) => {
    const kinds = on ? [...value.kinds, kind] : value.kinds.filter((k) => k !== kind)
    // Narrowing the dashboard says nothing about the link, so the gate is left
    // exactly as it was.
    set({ kinds, public: kinds.length === 0 && !isPrivate })
  }

  const allOn = value.kinds.length === AUDIENCE_KINDS.length

  return (
    <div className="space-y-4">
      {showGate && (
        <div className="rounded-2xl border border-gray-200 p-4">
          <Checkbox
            label="Private — only people signed in can view this"
            description="By default anybody with the link can open the page. Tick this and they are asked to sign in or create an account first; the details, photo and tickets stay hidden until they do."
            checked={isPrivate}
            onCheckedChange={(v) =>
              set({
                gate: v === true ? 'ASK' : 'SHOW',
                public: v !== true && value.kinds.length === 0,
              })
            }
          />
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Whose dashboard does this appear on?
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Separate from the link. Leave everything unticked and it appears for anyone signed
              in.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-orange-600 hover:underline"
            onClick={() =>
              allOn
                ? set({ kinds: [], public: !isPrivate })
                : set({ kinds: [...AUDIENCE_KINDS], public: false })
            }
          >
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <div className="mt-3 space-y-2.5">
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

        {value.kinds.length > 1 && value.match === 'ANY' && (
          <p className="mt-3 text-xs text-gray-500">
            Anyone in one or more of these. Most people are in several.
          </p>
        )}

        {value.match === 'ALL' && value.kinds.length > 1 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
            This one is set to people who are <strong>all</strong> of the above at once — a narrower
            rule from before this picker existed. Changing the ticks will widen it to anyone in any
            of them.
          </p>
        )}
      </div>

      <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        <span className="font-semibold text-gray-900">{describeAudienceRule(value)}</span>
        {value.kinds.length > 0 ? ' see it on their dashboard' : ' can see it'}
        {showGate
          ? isPrivate
            ? '. Anyone else opening the link is asked to sign in.'
            : ', and anyone with the link can open it.'
          : '.'}
      </p>
    </div>
  )
}
