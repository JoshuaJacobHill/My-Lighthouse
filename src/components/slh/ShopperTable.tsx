import Link from 'next/link'
import { StepTrack } from '@/components/slh/StepTrack'
import { SHOPPER_STATUS, shopperStatus, shortfall } from '@/lib/slh-admin'
import { describeRequest } from '@/lib/slh-onboarding'
import type { ShopperRow } from '@/lib/slh'

/**
 * Everybody who signed up to shop, and where they are up to.
 *
 * The waiting list is not a separate thing — it is this list filtered to the
 * people whose request has not been met. Keeping it as one view means the
 * number of people waiting is always visible next to the people being served,
 * rather than on a page somebody has to remember to open.
 */
const TONE: Record<string, string> = {
  waiting: 'bg-[#fdecef] text-[#c8102e]',
  shopping: 'bg-neutral-100 text-neutral-700',
  delivered: 'bg-green-50 text-green-700',
  'stepped-back': 'bg-neutral-100 text-neutral-400',
}

export function ShopperTable({
  rows,
  showOrganisation,
}: {
  rows: ShopperRow[]
  showOrganisation: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
        No shoppers match that.
      </p>
    )
  }

  return (
    <div className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
      {rows.map((row) => {
        const status = shopperStatus(row)
        const owed = shortfall(row)
        return (
          <div key={row.id} className="px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-bold">{row.name ?? row.email}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[status]}`}
              >
                {SHOPPER_STATUS[status].label}
                {status === 'waiting' && owed > 0 ? ` · ${owed}` : ''}
              </span>
              {showOrganisation && (
                <span className="text-[13px] text-neutral-500">{row.organisation}</span>
              )}
            </div>

            <p className="mt-0.5 text-[13px] text-neutral-400">
              {row.name ? `${row.email} · ` : ''}
              asked for {describeRequest(row)}
            </p>

            {row.held > 0 ? (
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
            ) : (
              <p className="mt-2 text-[13px] text-neutral-500">
                {status === 'waiting'
                  ? `Waiting on ${owed} wish ${owed === 1 ? 'list' : 'lists'}.`
                  : 'Not shopping this year.'}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** One line of counts, so the shape of the program is visible above the list. */
export function ShopperSummary({ rows }: { rows: ShopperRow[] }) {
  const waiting = rows.filter((r) => shopperStatus(r) === 'waiting')
  const owed = waiting.reduce((n, r) => n + shortfall(r), 0)

  return (
    <p className="mt-2 text-sm text-neutral-500">
      <b className="text-neutral-900">{rows.length}</b>{' '}
      {rows.length === 1 ? 'shopper' : 'shoppers'}
      {waiting.length > 0 && (
        <>
          {' · '}
          <b className="text-[#c8102e]">
            {waiting.length} waiting on {owed} {owed === 1 ? 'list' : 'lists'}
          </b>
        </>
      )}
      {' · '}
      {rows.reduce((n, r) => n + r.held, 0)} lists held
    </p>
  )
}

export function ShopperLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[13px] font-semibold underline underline-offset-2">
      {label}
    </Link>
  )
}
