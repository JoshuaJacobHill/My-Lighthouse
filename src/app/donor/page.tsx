import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ArrowUpRight, Heart, HandHeart } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isDonorPortalEnabled } from '@/lib/features'
import { claimDonationsForUser, getDonorGifts, summariseGifts } from '@/lib/donations'
import { StoriesGrid } from '@/components/donor/StoriesGrid'
import { StatusBadge } from '@/components/volunteer/StatusBadge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Lighthouse Care' }

const aud = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

// Home is the "what's happening" tab — Good News & updates, with quick glances
// into giving and volunteering that lead to those dedicated tabs.
export default async function DonorHomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      isChurchMember: true,
      volunteerProfile: {
        select: { status: true, _count: { select: { attendanceRecords: true } } },
      },
    },
  })
  if (!user) redirect('/login')

  await claimDonationsForUser(session.userId, user.email, user.emailVerified)

  const gifts = await getDonorGifts(session.userId)
  const summary = summariseGifts(gifts)
  const hasGifts = gifts.length > 0

  // Church givers get their tithe surfaced up top (separate from donations).
  const tithePlan = await prisma.donation.findFirst({
    where: { userId: session.userId, isTithe: true, isRecurring: true },
    orderBy: { createdAt: 'desc' },
    select: { amount: true, frequency: true },
  })
  const hasTithe = Boolean(tithePlan)

  const vp = user.volunteerProfile
  const isVolunteer = Boolean(vp)
  const firstName = user.name?.split(' ')[0] ?? 'there'
  const live = isDonorPortalEnabled()

  // Church members see church-only stories too; everyone else only public ones.
  const stories = await prisma.story.findMany({
    where: { isPublished: true, ...(user.isChurchMember ? {} : { churchOnly: false }) },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    take: 6,
    select: { id: true, title: true, category: true, excerpt: true, imageUrl: true, externalUrl: true },
  })

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {!live && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Preview — donor portal hidden from the public until launch
          </div>
        )}

        {/* Greeting */}
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-400">Welcome back</p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Hi, {firstName} <span className="font-normal">👋</span>
            </h1>
          </div>
          {vp && <StatusBadge status={vp.status} />}
        </header>

        {/* Glances — tithe (church givers) · giving · volunteering */}
        <section className="mb-14 space-y-5">
          {tithePlan && (
            <Link
              href="/donor/tithes"
              className="flex items-center justify-between gap-4 rounded-[28px] bg-neutral-950 p-7 text-white transition-transform active:scale-[0.99]"
            >
              <div>
                <p className="text-sm font-medium text-white/60">Lighthouse Family Church Tithes</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">
                  {aud(Number(tithePlan.amount))}
                  {tithePlan.frequency && <span className="text-lg font-semibold text-white/70"> {tithePlan.frequency}</span>}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white">
                Manage
              </span>
            </Link>
          )}

          <Link
            href="/donor/give"
            className="flex items-center justify-between gap-4 rounded-[28px] bg-orange-500 p-7 text-white transition-transform active:scale-[0.99]"
          >
            <div>
              {hasGifts ? (
                <>
                  <p className="text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">{aud(summary.allTime)}</p>
                  <p className="mt-1 text-sm text-orange-100">
                    {hasTithe ? 'Your charitable donations' : 'Your giving so far'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight">Give and change a life</p>
                  <p className="mt-1 text-sm text-orange-100">A $25 gift is a full trolley for a family.</p>
                </>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white">
              {hasGifts ? 'Go to giving' : 'Give now'}
            </span>
          </Link>

          <Link
            href="/volunteer"
            className="group block rounded-[28px] border border-neutral-200 p-7 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
          >
            <HandHeart className="h-7 w-7 text-orange-500" />
            <div className="mt-8">
              {isVolunteer ? (
                <>
                  <p className="text-sm font-medium text-neutral-400">Your volunteering</p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight">
                    {vp?._count.attendanceRecords ?? 0}
                    <span className="text-base font-medium text-neutral-400"> shifts attended</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-tight">Volunteer with us</p>
                  <p className="mt-1 text-sm text-neutral-500">Give your time alongside your generosity.</p>
                </>
              )}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-600">
                {isVolunteer ? 'Manage volunteering' : 'Get involved'} <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </section>

        {/* Good News & updates — the heart of Home */}
        {stories.length > 0 ? (
          <section>
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
                Good news &amp; <span className="font-extrabold">stories</span>
              </h2>
            </div>
            <StoriesGrid stories={stories} />
          </section>
        ) : (
          <section className="rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-orange-400" />
            <p className="mt-3 text-neutral-600">Good news stories will appear here soon.</p>
            <Link
              href="/donor/give"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Make a gift <ArrowUpRight className="h-4 w-4" />
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}
