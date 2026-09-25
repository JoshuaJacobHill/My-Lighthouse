'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StepTrack } from '@/components/slh/StepTrack'
import { BulkBar, BulkButton, RowTick } from '@/components/slh/BulkBar'
import { fillShoppersAction } from '@/lib/actions/slh.actions'
import { SHOPPER_STATUS, shopperStatus, shortfall } from '@/lib/slh-admin'
import { describeRequest } from '@/lib/slh-onboarding'
import type { ShopperRow } from '@/lib/slh'

/**
 * Every shopper, selectable, with the one bulk action that matters: give these
 * people the lists they are waiting on.
 *
 * That is the matching step, run deliberately rather than on a timer. It
 * reports what it could not do as well as what it did — a shopper left short
 * because nobody matching their request is waiting is a fact somebody has to
 * act on, and a silent "done" would hide it.
 */
const TONE: Record<string, string> = {
  waiting: 'bg-[#fdecef] text-[#c8102e]',
  shopping: 'bg-neutral-100 text-neutral-700',
  delivered: 'bg-green-50 text-green-700',
  'stepped-back': 'bg-neutral-100 text-neutral-400',
}

export function ShopperBulk({
  rows,
  showOrganisation,
}: {
  rows: ShopperRow[]
  showOrganisation: boolean
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const chosen = rows.filter((r) => picked.includes(r.id))
  const owed = chosen.reduce((n, r) => n + shortfall(r), 0)

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
        No shoppers match that.
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
          const status = shopperStatus(row)
          const short = shortfall(row)
          return (
            <div key={row.id} className="flex items-start gap-3 px-4 py-4">
              <RowTick
                checked={picked.includes(row.id)}
                onChange={() => {
                  setMessage(null)
                  setPicked((p) =>
                    p.includes(row.id) ? p.filter((x) => x !== row.id) : [...p, row.id],
                  )
                }}
                label={`Select ${row.name ?? row.email}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/admin/slh/shoppers/${row.id}`}
                    className="font-bold hover:underline"
                  >
                    {row.name ?? row.email}
                  </Link>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[status]}`}>
                    {SHOPPER_STATUS[status].label}
                    {status === 'waiting' && short > 0 ? ` · ${short}` : ''}
                  </span>
                  {showOrganisation && (
                    <span className="text-[13px] text-neutral-500">{row.organisation}</span>
                  )}
                </div>

                <p className="mt-0.5 text-[13px] text-neutral-400">
                  {row.name ? `${row.email} · ` : ''}
                  asked for {describeRequest(row)}
                </p>

                {row.held > 0 && (
                  <div className="mt-2.5 max-w-sm">
                    <StepTrack done={row.steps.done} total={row.steps.total} />
                    <p className="mt-1.5 text-xs text-neutral-500">
                      <span className="font-bold tabular-nums text-neutral-700">
                        {row.held} {row.held === 1 ? 'list' : 'lists'}
                      </span>
                      {' · '}
                      <span className="tabular-nums">
                        {row.steps.done}/{row.steps.total} steps
                      </span>
                      {row.delivered > 0 ? ` · ${row.delivered} delivered` : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <BulkBar count={picked.length} noun="shopper" busy={pending} onClear={() => setPicked([])}>
        <BulkButton
          disabled={pending || owed === 0}
          onClick={() => {
            setMessage(null)
            startTransition(async () => {
              const fd = new FormData()
              fd.set('shopperIds', JSON.stringify(picked))
              const result = await fillShoppersAction(fd)
              if (!result.success) {
                setMessage(result.error ?? 'That did not work.')
                return
              }
              // Say what could not be done, not just what could.
              setMessage(
                result.short
                  ? `Gave out ${result.assigned}. ${result.short} could not be matched — nobody waiting fits what they asked for.`
                  : `Gave out ${result.assigned}.`,
              )
              setPicked([])
              router.refresh()
            })
          }}
        >
          {owed > 0 ? `Give out ${owed} waiting ${owed === 1 ? 'list' : 'lists'}` : 'Nothing owed'}
        </BulkButton>
      </BulkBar>
    </>
  )
}
