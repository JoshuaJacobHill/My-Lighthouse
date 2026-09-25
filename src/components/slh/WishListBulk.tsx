'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { StepTrack } from '@/components/slh/StepTrack'
import { BulkBar, BulkButton, RowTick } from '@/components/slh/BulkBar'
import { assignChildrenAction, unassignChildrenAction } from '@/lib/actions/slh.actions'
import { LIST_STATUS, listStatus } from '@/lib/slh-admin'
import type { WishListRow } from '@/lib/slh'

/**
 * Every wish list, selectable, with the two things somebody does to a batch of
 * them: hand them to a shopper, or take them back.
 *
 * Assigning is deliberately a **choice of shopper**, not an automatic match.
 * The automatic version lives on the shoppers page, where the question is "give
 * these people what they asked for"; here the question is "this particular
 * child should go to this particular person", which is the one somebody
 * reaches for when they know something the matcher does not.
 */
const TONE: Record<string, string> = {
  unfilled: 'bg-[#fdecef] text-[#c8102e]',
  ready: 'bg-amber-50 text-amber-700',
  assigned: 'bg-neutral-100 text-neutral-700',
  delivered: 'bg-green-50 text-green-700',
}

export type ShopperOption = {
  id: string
  name: string
  organisationId: string
  /** How many more they are owed, for the menu to say so. */
  shortfall: number
}

export function WishListBulk({
  rows,
  shoppers,
  showOrganisation,
  showGuardian,
  hrefFor,
}: {
  rows: WishListRow[]
  shoppers: ShopperOption[]
  showOrganisation: boolean
  showGuardian: boolean
  hrefFor: (row: WishListRow) => string | null
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])
  const [shopperId, setShopperId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const chosen = rows.filter((r) => picked.includes(r.id))
  // Only lists nobody holds can be given away, and only held ones taken back.
  const assignable = chosen.filter((r) => !r.shopperId)
  const returnable = chosen.filter((r) => r.shopperId)

  // A shopper can only take children from their own organisation.
  const orgs = new Set(assignable.map((r) => r.organisationId))
  const eligible = shoppers.filter(
    (s) => orgs.size === 0 || (orgs.size === 1 && s.organisationId === [...orgs][0]),
  )

  function toggle(id: string) {
    setMessage(null)
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  function run(fn: () => Promise<{ success: boolean; error?: string }>, done: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      setMessage(result.error ?? (result.success ? done : 'That did not work.'))
      if (result.success) {
        setPicked([])
        setShopperId('')
        router.refresh()
      }
    })
  }

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
        No wish lists match that.
      </p>
    )
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPicked(picked.length === rows.length ? [] : rows.map((r) => r.id))}
          className="text-[13px] font-semibold text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
        >
          {picked.length === rows.length ? 'Select none' : `Select all ${rows.length}`}
        </button>
        {message && <span className="text-[13px] font-semibold text-neutral-700">{message}</span>}
      </div>

      <div className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
        {rows.map((row) => {
          const status = listStatus(row)
          const href = hrefFor(row)
          return (
            <div key={row.id} className="flex items-center gap-3 px-4 py-3.5">
              <RowTick
                checked={picked.includes(row.id)}
                onChange={() => toggle(row.id)}
                label={`Select ${row.firstName}`}
              />
              <ChildAvatar
                gender={row.gender === 'girl' ? 'girl' : 'boy'}
                className="h-11 w-11 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {href ? (
                    <Link href={href} className="font-bold hover:underline">
                      {row.firstName}
                    </Link>
                  ) : (
                    <span className="font-bold">{row.firstName}</span>
                  )}
                  <span className="text-[13px] text-neutral-400">
                    {row.gender === 'girl' ? 'Girl' : 'Boy'} {row.age}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[status]}`}
                  >
                    {LIST_STATUS[status].label}
                  </span>
                </div>
                <span className="mt-0.5 block text-[13px] text-neutral-400">
                  {[
                    showOrganisation ? row.organisation : null,
                    showGuardian && row.guardian ? row.guardian : null,
                    row.shopperName ? `Shopper: ${row.shopperName}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {row.shopperId && (
                  <span className="mt-2 block max-w-xs">
                    <StepTrack done={row.steps.done} total={row.steps.total} />
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <BulkBar count={picked.length} noun="list" busy={pending} onClear={() => setPicked([])}>
        {assignable.length > 0 && (
          <>
            <select
              value={shopperId}
              onChange={(e) => setShopperId(e.target.value)}
              aria-label="Give to"
              className="rounded-full bg-white/15 px-3 py-2 text-[13px] font-semibold text-white [&>option]:text-neutral-900"
            >
              <option value="">
                {orgs.size > 1 ? 'One organisation at a time' : 'Give to…'}
              </option>
              {eligible.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.shortfall > 0 ? ` — waiting on ${s.shortfall}` : ''}
                </option>
              ))}
            </select>
            <BulkButton
              disabled={!shopperId || pending || orgs.size > 1}
              onClick={() => {
                const fd = new FormData()
                fd.set('shopperId', shopperId)
                fd.set('childIds', JSON.stringify(assignable.map((r) => r.id)))
                run(() => assignChildrenAction(fd), `Gave out ${assignable.length}.`)
              }}
            >
              Give out {assignable.length}
            </BulkButton>
          </>
        )}

        {returnable.length > 0 && (
          <BulkButton
            tone="danger"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  `Take ${returnable.length} wish ${returnable.length === 1 ? 'list' : 'lists'} back? Anything ticked off will be cleared.`,
                )
              ) {
                return
              }
              const fd = new FormData()
              fd.set('childIds', JSON.stringify(returnable.map((r) => r.id)))
              run(() => unassignChildrenAction(fd), `Took back ${returnable.length}.`)
            }}
          >
            Take back {returnable.length}
          </BulkButton>
        )}
      </BulkBar>
    </>
  )
}
