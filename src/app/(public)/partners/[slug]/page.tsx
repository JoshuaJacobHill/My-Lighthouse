import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { getPublicPartner } from '@/lib/organisations'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  PARTNER: 'Partner',
  SPONSOR: 'Sponsor',
  APPEAL: 'Appeal',
  FUNDRAISER: 'Fundraiser',
  VOLUNTEERING: 'Volunteering',
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const partner = await getPublicPartner((await params).slug)
  if (!partner) return { title: 'Partner | Lighthouse Care' }
  return {
    title: `${partner.name} | Lighthouse Care partners`,
    description:
      partner.about?.slice(0, 160) ??
      `How ${partner.name} supports food relief across South East Queensland.`,
  }
}

export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const partner = await getPublicPartner((await params).slug)
  if (!partner) notFound()

  // Standing relationships first, then by year. A Foundation Partner badge is
  // the headline; the 2017 event sponsorship is history beneath it.
  const standing = partner.badges.filter((b) => b.year === null)
  const dated = partner.badges.filter((b) => b.year !== null)

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <Link
        href="/partners"
        className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        ← All partners
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-5">
        {partner.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={partner.logoUrl}
            alt=""
            className="h-20 w-auto max-w-[220px] object-contain"
          />
        )}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">{partner.name}</h1>
          {partner.website && (
            <a
              href={partner.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline"
            >
              {partner.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {standing.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-2">
          {standing.map((b) => (
            <span
              key={b.id}
              className="rounded-full bg-orange-500 px-4 py-1.5 text-sm font-bold text-white"
            >
              {b.tier ? `${b.tier} ` : ''}
              {b.label}
            </span>
          ))}
        </div>
      )}

      {partner.about && (
        <p className="mt-7 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-neutral-700">
          {partner.about}
        </p>
      )}

      {dated.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
            How they have helped
          </h2>
          <ul className="mt-4 space-y-3">
            {dated.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[20px] border border-neutral-200 px-5 py-4"
              >
                <span className="text-lg font-extrabold tabular-nums text-neutral-900">
                  {b.year}
                </span>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold uppercase text-neutral-600">
                  {KIND_LABEL[b.kind] ?? b.kind}
                </span>
                <span className="font-semibold text-neutral-900">
                  {b.tier ? `${b.tier} — ` : ''}
                  {b.label}
                </span>
                {b.amountCents !== null && (
                  <span className="font-bold text-orange-600">{money(b.amountCents)}</span>
                )}
                {b.detail && (
                  <span className="w-full text-sm leading-relaxed text-neutral-500">{b.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {partner.posts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">
            Their team, with us
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {partner.posts.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-[28px] border border-neutral-200">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-52 w-full object-cover" />
                )}
                {(p.caption || p.authorFirstName) && (
                  <div className="p-5">
                    {p.caption && (
                      <p className="whitespace-pre-line leading-relaxed text-neutral-700">
                        {p.caption}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-neutral-400">
                      {p.authorFirstName ? `${p.authorFirstName}` : 'Their team'}
                      {p.happenedAt
                        ? ` · ${new Intl.DateTimeFormat('en-AU', {
                            timeZone: 'Australia/Brisbane',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }).format(p.happenedAt)}`
                        : ''}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-14 rounded-[28px] bg-neutral-50 p-6 sm:p-8">
        <h2 className="text-xl font-extrabold tracking-tight">
          Could your business do something like this?
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-neutral-600">
          Bring a team to pack hampers, sponsor an event, or back the $25 Trolley. Every dollar of
          profit from our stores goes back into food relief.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/donate"
            className="inline-flex rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Give today
          </Link>
          <a
            href="https://lighthousecare.org.au"
            className="inline-flex rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            Talk to us
          </a>
        </div>
      </div>
    </div>
  )
}
