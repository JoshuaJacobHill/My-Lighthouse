import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { Heart } from 'lucide-react'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { ORG } from '@/lib/org'
import { FundraiserShare } from '@/components/FundraiserShare'
import { DonationTicker } from '@/components/DonationTicker'

export const dynamic = 'force-dynamic'

/** First name + last initial only, for the public donor wall (e.g. "Joel P."). */
function maskDonorName(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A supporter'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const fr = await prisma.fundraiser.findFirst({ where: { slug, isActive: true }, select: { title: true } })
  return { title: fr ? `${fr.title} — Lighthouse Care` : 'Fundraiser — Lighthouse Care' }
}

const aud2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })

type ContentBlock = {
  type?: 'imageText' | 'video'
  heading?: string
  body?: string
  bullets?: string[]
  imageUrl?: string
  side?: 'left' | 'right' // which side the media sits on
  videoUrl?: string
}

// Turn a YouTube watch/share URL into an embeddable URL.
function toEmbed(url: string): string {
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : url
}

function DonateButton({ slug, className = '' }: { slug: string; className?: string }) {
  return (
    <Link
      href={`/donate?fundraiser=${slug}`}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-orange-600 ${className}`}
    >
      <Heart className="h-5 w-5" /> Donate now
    </Link>
  )
}

export default async function FundraiserPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isDonorPortalEnabled()) notFound()

  const { slug } = await params
  const fundraiser = await prisma.fundraiser.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      title: true,
      storyHeading: true,
      story: true,
      contentBlocks: true,
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
      take: 60,
      select: { id: true, donorName: true, message: true, amount: true },
    }),
  ])

  const raised = Number(agg._sum.amount ?? 0)
  const goal = fundraiser.goalAmount ? Number(fundraiser.goalAmount) : null
  const pct = goal && goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null
  const donorCount = agg._count
  const blocks = (Array.isArray(fundraiser.contentBlocks) ? fundraiser.contentBlocks : []) as ContentBlock[]
  // Privacy: the public donor wall shows first name + last initial only, so full
  // supporter names aren't exposed/scrapeable (amounts stay, names are masked).
  const tickerDonations = donations.map((d) => ({
    ...d,
    donorName: maskDonorName(d.donorName),
    amount: Number(d.amount),
  }))

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const shareUrl = `${base}/fundraisers/${slug}`
  const qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 240, margin: 1 })

  return (
    <div className="min-h-screen bg-white">
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
          <DonateButton slug={slug} className="mt-8" />
          <div className="mt-6">
            <FundraiserShare url={shareUrl} title={fundraiser.title} qrDataUrl={qrDataUrl} onDark />
          </div>
        </div>
      </section>

      {/* ── Raised ───────────────────────────────────────────── */}
      <section className="px-6 py-14 text-center">
        <h2 className="text-lg font-medium uppercase tracking-wide text-gray-400">So far we have raised</h2>
        <p className="mt-2 text-5xl font-bold text-orange-500 sm:text-6xl">{aud2.format(raised)}</p>
        {goal && <p className="mt-3 text-2xl font-semibold text-gray-700">Our goal is to raise {aud2.format(goal)}</p>}
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
      <section className="mx-auto max-w-2xl px-6 pb-4 text-center">
        {fundraiser.storyHeading && (
          <h2 className="mb-6 text-3xl font-bold text-gray-900">{fundraiser.storyHeading}</h2>
        )}
        <div className="whitespace-pre-line text-lg leading-relaxed text-gray-600">{fundraiser.story}</div>
      </section>

      {/* ── Latest donations (ticker) ────────────────────────── */}
      {tickerDonations.length > 0 && (
        <section className="mt-10 bg-gray-50 py-12">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">Latest donations</h2>
          <DonationTicker donations={tickerDonations} />
        </section>
      )}

      {/* ── Content blocks ───────────────────────────────────── */}
      {blocks.length > 0 && (
        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          {blocks.map((b, i) => {
            const mediaRight = (b.side ?? (i % 2 === 0 ? 'right' : 'left')) === 'right'
            const media =
              b.type === 'video' && b.videoUrl ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                  <iframe
                    src={toEmbed(b.videoUrl)}
                    title={b.heading ?? 'Video'}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : b.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.imageUrl} alt={b.heading ?? ''} className="w-full rounded-xl object-cover" />
              ) : null

            return (
              <div key={i} className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
                <div className={media && mediaRight ? 'md:order-1' : 'md:order-2'}>
                  {b.heading && <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">{b.heading}</h3>}
                  {b.body && <p className="mt-4 whitespace-pre-line leading-relaxed text-gray-600">{b.body}</p>}
                  {b.bullets && b.bullets.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {b.bullets.map((li, j) => (
                        <li key={j} className="flex gap-2 font-medium text-gray-700">
                          <span className="text-orange-500">•</span> {li}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {media && <div className={mediaRight ? 'md:order-2' : 'md:order-1'}>{media}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Charity information ───────────────────────────────── */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">Charity information</h2>
          <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-square.png" alt="Lighthouse Care" className="h-9 w-9 rounded" />
            </span>
            <div>
              <p className="font-semibold text-gray-900">{ORG.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{ORG.blurb}</p>
              <a href={ORG.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-orange-600 hover:text-orange-700">
                Learn more →
              </a>
            </div>
          </div>
          <div className="mt-10 text-center">
            <DonateButton slug={slug} />
          </div>
          <p className="mt-8 text-center text-xs text-gray-400">
            {ORG.name} · ABN {ORG.abn} · Payments processed securely by Stripe.
          </p>
        </div>
      </section>
    </div>
  )
}
