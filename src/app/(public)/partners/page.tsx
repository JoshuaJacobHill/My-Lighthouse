import Link from 'next/link'
import type { Metadata } from 'next'
import { listPublicPartners } from '@/lib/organisations'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Our partners | Lighthouse Care',
  description:
    'The businesses, clubs and schools backing food relief across South East Queensland.',
}

export default async function PartnersPage() {
  const partners = await listPublicPartners()

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
        Alongside us
      </p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Our partners</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-neutral-600">
        Businesses, clubs and schools who pack hampers, sponsor events and turn up when families
        are doing it tough. Every one of them makes the next trolley possible.
      </p>

      {partners.length === 0 ? (
        <p className="mt-10 rounded-[28px] border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-500">
          Partner profiles are on their way.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/partners/${p.slug}`}
                className="flex h-full flex-col rounded-[28px] border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
              >
                {p.logoUrl ? (
                  // A partner's own logo, hosted wherever they gave it to us —
                  // not worth optimising through next/image for a handful.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.logoUrl}
                    alt=""
                    className="h-12 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <span className="flex h-12 items-center text-lg font-extrabold text-neutral-300">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <p className="mt-4 text-lg font-bold tracking-tight text-neutral-900">{p.name}</p>
                {p.topBadge && (
                  <p className="mt-1 text-sm text-neutral-500">{p.topBadge}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-14 rounded-[28px] bg-neutral-50 p-6 sm:p-8">
        <h2 className="text-xl font-extrabold tracking-tight">Support us as a business</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-neutral-600">
          Bring a team to pack hampers, sponsor an event, or run something of your own. If your
          company already supports us and you would like a profile here, ask us for one.
        </p>
        {/* The portal has no public contact page; the main site does. Swap
            this for an internal route if one ever lands. */}
        <a
          href="https://lighthousecare.org.au"
          className="mt-5 inline-flex rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          Talk to us
        </a>
      </div>
    </div>
  )
}
