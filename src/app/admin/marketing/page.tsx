import Link from 'next/link'
import { ChevronLeft, Sparkles } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requireCapability } from '@/lib/permissions'
import { listMedia } from '@/lib/media-library'
import { ProposalCard, type Proposal } from './ProposalCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Marketing approvals' }

/**
 * The approval queue.
 *
 * Everything the assistant has suggested, waiting on a person. Nothing here
 * has reached the public or spent a cent until somebody presses the button on
 * the card, and each button says exactly what it will do rather than
 * "Approve" — a queue you can click through without reading is not a gate.
 */
export default async function MarketingApprovalsPage() {
  await requireCapability('business.reports')

  const [rows, assets] = await Promise.all([
    prisma.marketingProposal.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 60,
    }),
    listMedia(12),
  ])

  // Names, resolved in one query rather than a relation — a proposal outlives
  // the account that made it, so the id is deliberately not a foreign key.
  const ids = [
    ...new Set(
      rows.flatMap((r) => [r.proposedByUserId, r.approvedByUserId].filter(Boolean) as string[]),
    ),
  ]
  const people = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true },
      })
    : []
  const nameOf = (id: string | null) => {
    if (!id) return null
    const p = people.find((x) => x.id === id)
    return p?.name?.split(/\s+/)[0] ?? p?.email ?? null
  }

  const proposals: Proposal[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    summary: r.summary,
    rationale: r.rationale,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    before: (r.before ?? null) as Record<string, unknown> | null,
    result: (r.result ?? null) as Record<string, unknown> | null,
    createdAt: r.createdAt.toISOString(),
    executedAt: r.executedAt?.toISOString() ?? null,
    error: r.error,
    proposedByName: nameOf(r.proposedByUserId),
    approvedByName: nameOf(r.approvedByUserId),
  }))

  const waiting = proposals.filter((p) => p.status === 'DRAFT' || p.status === 'FAILED')
  const settled = proposals.filter((p) => p.status !== 'DRAFT' && p.status !== 'FAILED')

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link
        href="/dashboard/business"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Sales &amp; marketing
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Marketing approvals</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-neutral-500">
        What the assistant has suggested. Nothing here has been posted or changed — pressing the
        button on a card is what makes it happen, and each button says what it will do.
      </p>

      {waiting.length === 0 ? (
        <div className="mt-7 flex items-start gap-4 rounded-[28px] bg-neutral-50 p-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-600">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-bold text-neutral-900">Nothing waiting</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              Ask the assistant on the{' '}
              <Link href="/dashboard/business" className="font-semibold text-orange-600 underline">
                sales and marketing page
              </Link>{' '}
              what to post or what to change, and anything it suggests turns up here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-neutral-400">
            {waiting.length} waiting on you
          </h2>
          <ul className="mt-4 space-y-4">
            {waiting.map((p) => (
              <ProposalCard key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}

      {settled.length > 0 && (
        <>
          <h2 className="mt-12 text-sm font-bold uppercase tracking-wide text-neutral-400">
            Already decided
          </h2>
          <ul className="mt-4 space-y-4">
            {settled.map((p) => (
              <ProposalCard key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}

      <section className="mt-10 flex flex-wrap items-center gap-4 rounded-[28px] bg-neutral-50 p-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-neutral-900">Media library</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">
            {assets.length === 0
              ? 'Empty. Until there is an image in it, the assistant can only draft text-only Facebook posts.'
              : `${assets.length} ${assets.length === 1 ? 'image' : 'images'} the assistant can use in a post or an ad.`}
          </p>
        </div>
        <Link
          href="/admin/media"
          className="inline-flex shrink-0 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white"
        >
          {assets.length === 0 ? 'Add images' : 'Open the library'}
        </Link>
      </section>

      <p className="mt-10 border-t border-neutral-100 pt-6 text-sm leading-relaxed text-neutral-500">
        Posting and ad changes need permissions the read-only feeds do not:{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">pages_manage_posts</code>,{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
          instagram_content_publish
        </code>{' '}
        and <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">ads_management</code> on
        the Meta system user. Until those are granted, approving a card fails with Meta&rsquo;s own
        message naming the missing one, and the card can be tried again afterwards. Budget changes
        are capped at $500/day whatever anyone types.{' '}
        <Link href="/admin/meta-scopes" className="font-semibold text-orange-600 underline">
          Check what the token can do
        </Link>
        .
      </p>
    </div>
  )
}
