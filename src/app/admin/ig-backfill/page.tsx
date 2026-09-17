import prisma from '@/lib/prisma'
import { requireCapability } from '@/lib/permissions'
import { BackfillRunner } from './BackfillRunner'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Instagram backfill' }

const when = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        dateStyle: 'medium',
      }).format(d)
    : '—'

export default async function IgBackfillPage() {
  await requireCapability('business.reports')

  // What we already hold, so the run has something to be measured against.
  const [count, oldest, newest] = await Promise.all([
    prisma.socialPost.count({ where: { platform: 'INSTAGRAM' } }),
    prisma.socialPost.findFirst({
      where: { platform: 'INSTAGRAM' },
      orderBy: { publishedAt: 'asc' },
      select: { publishedAt: true },
    }),
    prisma.socialPost.findFirst({
      where: { platform: 'INSTAGRAM' },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Instagram backfill</h1>
      <p className="mt-2 leading-relaxed text-neutral-500">
        Reads the Instagram back catalogue into the reports. Only needed once, or after a long gap
        — the nightly job keeps up with new posts on its own.
      </p>

      <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 rounded-[28px] bg-neutral-50 p-6">
        <div>
          <div className="text-3xl font-extrabold tabular-nums tracking-tight">{count}</div>
          <div className="text-xs text-neutral-500">posts held now</div>
        </div>
        <div>
          <div className="text-lg font-bold">{when(oldest?.publishedAt ?? null)}</div>
          <div className="text-xs text-neutral-500">oldest we have</div>
        </div>
        <div>
          <div className="text-lg font-bold">{when(newest?.publishedAt ?? null)}</div>
          <div className="text-xs text-neutral-500">newest we have</div>
        </div>
      </div>

      <BackfillRunner />

      <p className="mt-6 text-sm leading-relaxed text-neutral-500">
        Each pass reads for about a minute and stops on the near side of the time limit, then the
        next one carries on from exactly where it stopped. Leave the tab open. Closing it stops the
        run — nothing already read is lost, and starting again picks up from the last finished pass.
      </p>
    </div>
  )
}
