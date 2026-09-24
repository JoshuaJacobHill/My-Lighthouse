import Link from 'next/link'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { StepTrack } from '@/components/slh/StepTrack'
import { LIST_STATUS, listStatus } from '@/lib/slh-admin'
import type { WishListRow } from '@/lib/slh'

/**
 * Every wish list, and what is holding each one up.
 *
 * The guardian's name appears only where the viewer already administers that
 * organisation — Lighthouse sees the child and the status, which is what it
 * needs to run the program. A shopper's name is shown to both, because knowing
 * who is holding a list is the point of the column.
 */
const TONE: Record<string, string> = {
  unfilled: 'bg-[#fdecef] text-[#c8102e]',
  ready: 'bg-amber-50 text-amber-700',
  assigned: 'bg-neutral-100 text-neutral-700',
  delivered: 'bg-green-50 text-green-700',
}

export function WishListTable({
  rows,
  showOrganisation,
  showGuardian,
  hrefFor,
}: {
  rows: WishListRow[]
  showOrganisation: boolean
  showGuardian: boolean
  /** Where a row leads, or null for a list that is not editable from here. */
  hrefFor: (row: WishListRow) => string | null
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
        No wish lists match that.
      </p>
    )
  }

  return (
    <div className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
      {rows.map((row) => {
        const status = listStatus(row)
        const href = hrefFor(row)

        const body = (
          <>
            <ChildAvatar
              gender={row.gender === 'girl' ? 'girl' : 'boy'}
              className="h-12 w-12 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-bold">{row.firstName}</span>
                <span className="text-[13px] text-neutral-400">
                  {row.gender === 'girl' ? 'Girl' : 'Boy'} {row.age}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[status]}`}>
                  {LIST_STATUS[status].label}
                </span>
              </span>

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
            </span>
          </>
        )

        return href ? (
          <Link
            key={row.id}
            href={href}
            className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-neutral-50"
          >
            {body}
          </Link>
        ) : (
          <div key={row.id} className="flex items-center gap-3.5 px-5 py-3.5">
            {body}
          </div>
        )
      })}
    </div>
  )
}

/** Counts above the list, led by the number somebody has to act on. */
export function WishListSummary({ rows }: { rows: WishListRow[] }) {
  const by = (s: string) => rows.filter((r) => listStatus(r) === s).length
  const unfilled = by('unfilled')

  return (
    <p className="mt-2 text-sm text-neutral-500">
      <b className="text-neutral-900">{rows.length}</b> {rows.length === 1 ? 'child' : 'children'}
      {unfilled > 0 && (
        <>
          {' · '}
          <b className="text-[#c8102e]">{unfilled} not filled in</b>
        </>
      )}
      {' · '}
      {by('ready')} ready · {by('assigned')} with a shopper · {by('delivered')} delivered
    </p>
  )
}
