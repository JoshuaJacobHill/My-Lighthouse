import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { Heart, Users } from 'lucide-react'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { formatDate } from '@/lib/utils'
import { FundraiserShare } from '@/components/FundraiserShare'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const fr = await prisma.fundraiser.findFirst({ where: { slug, isActive: true }, select: { title: true } })
  return { title: fr ? `${fr.title} — Lighthouse Care` : 'Fundraiser — Lighthouse Care' }
}

const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const aud2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export default async function FundraiserPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isDonorPortalEnabled()) notFound()

  const { slug } = await params
  const fundraiser = await prisma.fundraiser.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      title: true,
      story: true,
      imageUrl: true,
      goalAmount: true,
      organiserName: true,
    },
  })
  if (!fundraiser) notFound()

  const [agg, donations] = await Promise.all([
    prisma.donation.aggregate({ where: { fundraiserId: fundraiser.id }, _sum: { amount: true }, _count: true }),
    prisma.donation.findMany({
      where: { fundraiserId: fundraiser.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, donorName: true, message: true, amount: true, createdAt: true },
    }),
  ])

  const raised = Number(agg._sum.amount ?? 0)
  const goal = fundraiser.goalAmount ? Number(fundraiser.goalAmount) : null
  const pct = goal && goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null
  const donorCount = agg._count

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const shareUrl = `${base}/fundraisers/${slug}`
  const qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 240, margin: 1 })

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {fundraiser.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fundraiser.imageUrl} alt="" className="h-56 w-full object-cover sm:h-72" />
      )}

      <div className="mx-auto max-w-2xl px-6">
        <div className={fundraiser.imageUrl ? '-mt-10' : 'pt-12'}>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{fundraiser.title}</h1>
            <p className="mt-1 text-sm text-gray-500">Fundraising for Lighthouse Care · organised by {fundraiser.organiserName}</p>

            <div className="mt-6">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-bold text-gray-900">{aud0.format(raised)}</span>
                <span className="text-gray-400">raised{goal ? ` of ${aud0.format(goal)} goal` : ''}</span>
              </div>
              {pct !== null && (
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500">
                <Users className="h-4 w-4" /> {donorCount} {donorCount === 1 ? 'donation' : 'donations'}
              </p>
            </div>

            <Link
              href={`/donate?fundraiser=${slug}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <Heart className="h-4 w-4" /> Donate to this fundraiser
            </Link>

            <FundraiserShare url={shareUrl} title={fundraiser.title} qrDataUrl={qrDataUrl} />
          </div>

          <div className="mt-8 whitespace-pre-line leading-relaxed text-gray-700">{fundraiser.story}</div>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Donations</h2>
            {donations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                Be the first to donate.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {donations.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                        <Heart className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{d.donorName || 'Anonymous'}</p>
                        {d.message ? (
                          <p className="mt-0.5 text-sm text-gray-600">“{d.message}”</p>
                        ) : (
                          <p className="text-xs text-gray-400">{formatDate(d.createdAt)}</p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-gray-900">{aud2.format(Number(d.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
