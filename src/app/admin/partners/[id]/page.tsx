import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requireCapability } from '@/lib/permissions'
import { getOrgForAdmin } from '@/lib/organisations'
import { PartnerControls } from './PartnerControls'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Partner' }

const KIND_LABEL: Record<string, string> = {
  PARTNER: 'Partner',
  SPONSOR: 'Sponsor',
  APPEAL: 'Appeal',
  FUNDRAISER: 'Fundraiser',
  VOLUNTEERING: 'Volunteering',
}

const when = (d: Date) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium' }).format(d)

export default async function AdminPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability('care.giving')
  const org = await getOrgForAdmin((await params).id)
  if (!org) notFound()

  // This partner's fundraisers, and every one attached to nobody — the second
  // set is what the "attach an existing fundraiser" picker offers, so an
  // appeal a company ran before they had a page can be moved onto it.
  const fundraisers = await prisma.fundraiser.findMany({
    where: { OR: [{ organisationId: org.id }, { organisationId: null }] },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, slug: true, isActive: true, organisationId: true },
  })
  const raisedBy = new Map(
    (
      await prisma.donation.groupBy({
        by: ['fundraiserId'],
        where: { fundraiserId: { in: fundraisers.map((f) => f.id) } },
        _sum: { amount: true },
      })
    ).map((r) => [r.fundraiserId, Math.round(Number(r._sum.amount ?? 0) * 100)]),
  )

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link
        href="/admin/partners"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Partners
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {org.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt="" className="h-14 w-auto max-w-[180px] object-contain" />
        )}
        <h1 className="text-3xl font-extrabold tracking-tight">{org.name}</h1>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-neutral-500">
        <span>Applied {when(org.createdAt)}</span>
        {org.emailDomain && <span className="font-mono text-xs">{org.emailDomain}</span>}
        {org.status === 'ACTIVE' && org.isPublished && (
          <Link
            href={`/partners/${org.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 font-semibold text-orange-600 hover:underline"
          >
            View the public page
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </p>

      {org.requestNote && (
        <div className="mt-5 rounded-[28px] bg-neutral-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            What they told us
          </p>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-neutral-700">
            {org.requestNote}
          </p>
        </div>
      )}

      {org.status === 'DECLINED' && org.reviewNote && (
        <p className="mt-5 rounded-[28px] bg-neutral-100 p-5 text-sm text-neutral-600">
          Declined — {org.reviewNote}
        </p>
      )}

      <PartnerControls
        org={{
          id: org.id,
          name: org.name,
          slug: org.slug,
          website: org.website,
          about: org.about,
          logoUrl: org.logoUrl,
          contactName: org.contactName,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
          status: org.status,
          isPublished: org.isPublished,
        }}
        recognitions={org.recognitions.map((r) => ({
          id: r.id,
          kind: r.kind,
          year: r.year,
          tier: r.tier,
          label: r.label,
          detail: r.detail,
          amountCents: r.amountCents,
          showAmount: r.showAmount,
        }))}
        members={org.members.map((m) => ({
          id: m.id,
          role: m.role,
          status: m.status,
          position: m.position,
          name: m.user.name,
          email: m.user.email,
        }))}
        posts={org.posts.map((p) => ({
          id: p.id,
          caption: p.caption,
          imageUrl: p.imageUrl,
          isApproved: p.isApproved,
          authorName: p.author?.name ?? null,
          createdAt: p.createdAt.toISOString(),
        }))}
        fundraisers={fundraisers.map((f) => ({
          id: f.id,
          title: f.title,
          slug: f.slug,
          isActive: f.isActive,
          organisationId: f.organisationId,
          raisedCents: raisedBy.get(f.id) ?? 0,
        }))}
        kindLabels={KIND_LABEL}
      />
    </div>
  )
}
