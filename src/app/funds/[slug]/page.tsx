import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Heart, ArrowRight, ImageIcon } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { Markdown } from '@/components/ui/Markdown'

export const dynamic = 'force-dynamic'

const aud0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const fund = await prisma.fund.findUnique({ where: { slug }, select: { name: true, tagline: true } })
  return { title: fund ? `${fund.name} — Lighthouse Care` : 'Give — Lighthouse Care', description: fund?.tagline ?? undefined }
}

export default async function FundPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const fund = await prisma.fund.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      tagline: true,
      imageUrl: true,
      goalAmount: true,
      showPublicProgress: true,
    },
  })
  if (!fund) notFound()

  const [{ _sum }, session] = await Promise.all([
    prisma.donation.aggregate({ where: { fundId: fund.id }, _sum: { amount: true } }),
    getSession(),
  ])
  const raised = Number(_sum.amount ?? 0)
  const goal = fund.goalAmount ? Number(fund.goalAmount) : null
  const pct = goal && goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null
  // Only reveal the raised total when the fund opts into public progress.
  const showProgress = fund.showPublicProgress

  // Logged-in donors get the fast on-page flow; everyone else the full form.
  const giveHref = session ? `/give/again?fund=${fund.slug}` : `/donate?fund=${fund.slug}`

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Image src="/logo-inline-black.png" alt="Lighthouse Care" width={160} height={40} className="h-7 w-auto" />
          <Link href={giveHref} className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            Donate
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* Image */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] bg-neutral-200">
          {fund.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fund.imageUrl} alt={fund.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-400">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
        </div>

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">{fund.name}</h1>
        {fund.tagline && <p className="mt-2 text-lg text-neutral-500">{fund.tagline}</p>}

        {/* Give (with progress only when the fund opts in) */}
        <div className="mt-6 rounded-[28px] border border-neutral-200 bg-white p-6">
          {showProgress ? (
            <>
              <p className="text-3xl font-extrabold tabular-nums text-neutral-950">
                {aud0.format(raised)}
                {goal && <span className="text-base font-medium text-neutral-400"> raised of {aud0.format(goal)} goal</span>}
              </p>
              {pct !== null && (
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                </div>
              )}
            </>
          ) : (
            <p className="text-neutral-600">
              Your gift helps families doing it tough across South East Queensland.
            </p>
          )}
          <Link
            href={giveHref}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-4 text-lg font-bold text-white transition-transform active:scale-[0.99]"
          >
            <Heart className="h-5 w-5" /> Give now
          </Link>
        </div>

        {/* Description */}
        {fund.description && (
          <div className="mt-8">
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">About this appeal</h2>
            <Markdown source={fund.description} className="mt-3 text-neutral-600" />
          </div>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-neutral-200 pt-6 text-sm text-neutral-500">
          <span>Lighthouse Care · ACNC registered charity</span>
          <Link href={giveHref} className="inline-flex items-center gap-1 font-semibold text-orange-600 hover:text-orange-700">
            Give <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}
