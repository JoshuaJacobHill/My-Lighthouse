'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'

export type FamilyRow = {
  id: string
  guardian: string
  email: string
  phone: string
  children: { id: string; name: string; age: number; complete: boolean }[]
}

/**
 * The families an organisation has nominated, and the two things they do with
 * them: chase the unfinished lists, and pick several at once.
 *
 * Nothing sends without a confirmation naming who gets it. An email to a family
 * at Christmas, from a service they are already leaning on, is not something to
 * fire off a single tap — so the dialog lists them, by name, with the address
 * it would use.
 *
 * The send is a no-op here. There is no program schema yet, so this shows the
 * shape of the interaction rather than performing it, and says so.
 */
export function FamilyList({
  families,
  organisationId,
}: {
  families: FamilyRow[]
  organisationId: string
}) {
  const [picking, setPicking] = React.useState(false)
  const [picked, setPicked] = React.useState<string[]>([])
  const [confirming, setConfirming] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const outstanding = families.filter((f) => f.children.some((c) => !c.complete))
  const targets = picked.length ? families.filter((f) => picked.includes(f.id)) : outstanding

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Families</h2>
        <button
          type="button"
          onClick={() => {
            setPicking((p) => !p)
            setPicked([])
          }}
          className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-bold hover:bg-neutral-50"
        >
          {picking ? 'Done' : 'Select'}
        </button>
      </div>

      {outstanding.length > 0 ? (
        <p className="mt-1.5 text-sm text-neutral-500">
          <b className="text-[#c8102e]">
            {outstanding.length} still to fill
          </b>{' '}
          —{' '}
          {outstanding
            .flatMap((f) => f.children.filter((c) => !c.complete).map((c) => c.name))
            .join(', ')}
          .{' '}
          {sent ? (
            <span className="font-bold text-green-700">Reminder sent.</span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="font-bold text-neutral-900 underline underline-offset-2"
            >
              Email a reminder
            </button>
          )}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-neutral-500">
          Every wish list is filled in. Nothing to chase.
        </p>
      )}

      <div className="mt-3 divide-y divide-neutral-100">
        {families.map((family) => (
          <div key={family.id} className="py-4">
            <div className="flex items-center gap-3">
              {picking && (
                <button
                  type="button"
                  onClick={() => toggle(family.id)}
                  aria-pressed={picked.includes(family.id)}
                  aria-label={`Select ${family.guardian}`}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 ${
                    picked.includes(family.id)
                      ? 'border-[#c8102e] bg-[#c8102e] text-white'
                      : 'border-neutral-200 text-transparent'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{family.guardian}</p>
                <p className="text-[13px] text-neutral-400">
                  {family.phone} · {family.email}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {family.children.map((child) => (
                // The chip is the way in to the wish list. A dashed one is a
                // list nobody has filled in — which is exactly the one somebody
                // needs to open.
                <Link
                  key={child.id}
                  href={`/dashboard/slh/org/${organisationId}/child/${child.id}`}
                  className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold transition-colors hover:border-neutral-900 ${
                    child.complete
                      ? 'border-neutral-200'
                      : 'border-dashed border-neutral-300 text-neutral-500'
                  }`}
                >
                  <span
                    className={`grid h-[18px] w-[18px] place-items-center rounded-full ${
                      child.complete ? 'bg-green-600 text-white' : 'bg-neutral-100 text-transparent'
                    }`}
                  >
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                  {child.name} <span className="font-normal text-neutral-400">{child.age}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {picking && picked.length > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center gap-2 rounded-full bg-neutral-950 py-2 pl-5 pr-2 text-white">
          <b className="mr-auto text-sm">{picked.length} selected</b>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold hover:bg-white/25"
          >
            Remind
          </button>
          <button
            type="button"
            onClick={() => {
              setPicking(false)
              setPicked([])
            }}
            className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold hover:bg-white/25"
          >
            Cancel
          </button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/40 p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remind-title"
            className="w-full max-w-sm rounded-[28px] border-2 border-neutral-950 bg-white p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="remind-title" className="text-xl font-extrabold tracking-tight">
                Send a reminder?
              </h3>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                aria-label="Close"
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-sm text-neutral-500">
              {targets.length} famil{targets.length === 1 ? 'y' : 'ies'} will get an email asking
              them to finish their wish list{targets.length === 1 ? '' : 's'}.
            </p>

            <ul className="mt-4 grid gap-2.5">
              {targets.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#c8102e]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{f.guardian}</span>
                    <span className="block text-[13px] text-neutral-400">{f.email}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSent(true)
                  setConfirming(false)
                  setPicking(false)
                  setPicked([])
                }}
                className="rounded-full bg-[#c8102e] py-3 text-[15px] font-bold text-white hover:bg-[#9d0b23]"
              >
                Send {targets.length} reminder{targets.length === 1 ? '' : 's'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border-2 border-neutral-900 py-3 text-[15px] font-bold hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-neutral-400">
              Preview — no email is actually sent.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
