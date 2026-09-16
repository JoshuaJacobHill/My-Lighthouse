import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireCapability } from '@/lib/permissions'
import { listOrgsForAdmin } from '@/lib/organisations'
import { NewPartnerButton } from './NewPartnerButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Partners' }

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-lime-100 text-lime-800',
  DECLINED: 'bg-neutral-100 text-neutral-500',
}

export default async function AdminPartnersPage() {
  await requireCapability('care.giving')
  const orgs = await listOrgsForAdmin()
  const waiting = orgs.filter((o) => o.status === 'PENDING')

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Partners</h1>
          <p className="mt-2 max-w-xl text-neutral-500">
            Businesses, clubs and schools with a profile. Badges are added here and nowhere else —
            a partner cannot award themselves one.
          </p>
        </div>
        <NewPartnerButton />
      </div>

      {waiting.length > 0 && (
        <div className="mt-7 rounded-[28px] border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">
            {waiting.length} waiting on us
          </h2>
          <ul className="mt-3 space-y-2">
            {waiting.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/partners/${o.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 transition-colors hover:bg-neutral-50"
                >
                  <span>
                    <span className="font-semibold text-neutral-900">{o.name}</span>
                    {o.emailDomain && (
                      <span className="ml-2 font-mono text-xs text-neutral-500">
                        {o.emailDomain}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {orgs.length === 0 ? (
        <p className="mt-8 rounded-[28px] border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-500">
          No partners yet. Add one with the button above.
        </p>
      ) : (
        <ul className="mt-7 divide-y divide-neutral-100 rounded-[28px] border border-neutral-200">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/partners/${o.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-neutral-50"
              >
                {o.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-400">
                    {o.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-neutral-900">{o.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {o._count.recognitions} badge{o._count.recognitions === 1 ? '' : 's'} ·{' '}
                    {o._count.members} in the team · {o._count.posts} post
                    {o._count.posts === 1 ? '' : 's'}
                  </p>
                </div>
                <span
                  className={
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ' +
                    (STATUS_STYLE[o.status] ?? 'bg-neutral-100 text-neutral-600')
                  }
                >
                  {o.status.toLowerCase()}
                </span>
                {o.status === 'ACTIVE' && (
                  <span
                    className={
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ' +
                      (o.isPublished
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-500')
                    }
                  >
                    {o.isPublished ? 'live' : 'draft'}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
