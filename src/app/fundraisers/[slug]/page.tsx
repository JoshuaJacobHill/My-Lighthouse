import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { Heart } from 'lucide-react'
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

const aud2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const audCents = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })

export default async function FundraiserPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isDonorPortalEnabled()) notFound()

  const { slug } = await params
  const fundraiser = await prisma.fundraiser.findFirst({
    where: { slug, isActive: true },
    select: { id: true, title: true, story: true, imageUrl: true, goalAmount: true, organiserName: true },
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
    <div className="min-h-screen bg-white pb-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-[460px] items-center justify-center overflow-hidden px-6 py-16">
        {fundraiser.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fundraiser.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/65" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-orange-700" />
        )}

        <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-square.png" alt="Lighthouse Care" className="h-12 w-12 rounded" />
          </span>
          <p className="mt-4 text-sm font-medium uppercase tracking-wide text-white/80">Lighthouse Care</p>
          <h1 className="mt-2 text-3xl font-bold text-white drop-shadow sm:text-5xl">{fundraiser.title}</h1>

          <Link
            href={`/donate?fundraiser=${slug}`}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-orange-600"
          >
            <Heart className="h-5 w-5" /> Donate now
          </Link>

          <div className="mt-6">
            <FundraiserShare url={shareUrl} title={fundraiser.title} qrDataUrl={qrDataUrl} onDark />
          </div>
        </div>
      </section>

      {/* ── Raised ───────────────────────────────────────────── */}
      <section className="px-6 py-14 text-center">
        <h2 className="text-lg font-medium uppercase tracking-wide text-gray-400">So far we have raised</h2>
        <p className="mt-2 text-5xl font-bold text-orange-500 sm:text-6xl">{aud2.format(raised)}</p>
        {goal && (
          <p className="mt-2 text-gray-500">Our goal is to raise {aud2.format(goal)}</p>
        )}
        {pct !== null && (
          <div className="mx-auto mt-6 h-3 w-full max-w-xl overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
          </div>
        )}
        <p className="mt-3 text-sm text-gray-400">
          {donorCount} {donorCount === 1 ? 'donation' : 'donations'} · organised by {fundraiser.organiserName}
        </p>
      </section>

      {/* ── Story ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-6">
        <div className="whitespace-pre-line text-lg leading-relaxed text-gray-700">{fundraiser.story}</div>
      </section>

      {/* ── Donations ────────────────────────────────────────── */}
      <section className="mx-auto mt-14 max-w-2xl px-6">
        <h2 className="mb-5 text-center text-2xl font-bold text-gray-900">Latest donations</h2>
        {donations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
            Be the first to donate.
          </p>
        ) : (
          <ul className="space-y-3">
            {donations.map((d) => (
              <li key={d.id} className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xl">
                  💛
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-gray-900">{d.donorName || 'Anonymous'}</p>
                    <p className="shrink-0 font-bold tabular-nums text-gray-900">{audCents.format(Number(d.amount))}</p>
                  </div>
                  {d.message ? (
                    <p className="mt-1 text-gray-600">{d.message}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(d.createdAt)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 text-center">
          <Link
            href={`/donate?fundraiser=${slug}`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            <Heart className="h-5 w-5" /> Donate now
          </Link>
        </div>
      </section>
    </div>
  )
}
