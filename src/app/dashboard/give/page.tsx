import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ArrowUpRight, Heart, Repeat, Church } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getDonorGifts, summariseGifts } from '@/lib/donations'
import { listMyRecurringGifts } from '@/lib/actions/recurring.actions'
import { AppealsCarousel, type AppealItem } from '@/components/donor/AppealsCarousel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Give — Lighthouse Care' }

const aud = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

export default async function GiveHubPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const gifts = await getDonorGifts(session.userId)
  const summary = summariseGifts(gifts)
  const hasGifts = gifts.length > 0

  // Whether the donor has a *currently active* recurring plan is the live truth
  // in Stripe — a cancelled plan still leaves isRecurring gifts on record, so we
  // must not infer "recurring" from past gifts. (Tithes are excluded upstream.)
  const activeRecurring = (await listMyRecurringGifts()).filter((g) => g.active)
  const hasActiveRecurring = activeRecurring.length > 0
  const recurringSummary =
    activeRecurring.length === 1
      ? `${aud(activeRecurring[0].amount)} · ${activeRecurring[0].frequencyLabel}`
      : activeRecurring.length > 1
        ? `${activeRecurring.length} recurring gifts`
        : null

  const tithePlan = await prisma.donation.findFirst({
    where: { userId: session.userId, isTithe: true, isRecurring: true },
    orderBy: { createdAt: 'desc' },
    select: { amount: true, frequency: true },
  })

  // Appeals (respect public-progress flag for the raised figure).
  const funds = await prisma.fund.findMany({
    where: { isActive: true, showOnDashboard: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, tagline: true, goalAmount: true, imageUrl: true, showPublicProgress: true },
  })
  const raised = new Map<string, number>()
  if (funds.length) {
    const grouped = await prisma.donation.groupBy({
      by: ['fundId'],
      where: { fundId: { in: funds.map((f) => f.id) } },
      _sum: { amount: true },
    })
    for (const g of grouped) if (g.fundId) raised.set(g.fundId, Number(g._sum.amount ?? 0))
  }
  const appeals: AppealItem[] = funds.map((f) => ({
    slug: f.slug,
    name: f.name,
    tagline: f.tagline,
    goal: f.showPublicProgress && f.goalAmount ? Number(f.goalAmount) : null,
    imageUrl: f.imageUrl,
    raised: f.showPublicProgress ? (raised.get(f.id) ?? 0) : 0,
  }))

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Give</h1>
        <p className="mt-2 text-neutral-500">Every dollar donated goes a long way to providing food relief to families who really need it. Thank you so much for your support.</p>

        {/* Give now + your giving */}
        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="rounded-[28px] bg-orange-500 p-8 text-white lg:col-span-2">
            {hasGifts ? (
              <>
                {hasActiveRecurring && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">
                      <Repeat className="h-3 w-3" /> Recurring
                    </span>
                    <span className="text-sm font-semibold text-white">{recurringSummary}</span>
                  </div>
                )}
                <p className="text-sm font-medium text-orange-100">Your giving this financial year</p>
                <p className="mt-2 text-6xl font-extrabold tracking-tighter tabular-nums">{aud(summary.financialYear)}</p>
                <p className="mt-2 text-sm text-orange-100">
                  {aud(summary.allTime)} total · {summary.count} {summary.count === 1 ? 'gift' : 'gifts'}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold tracking-tight">Give and change a life</h2>
                <p className="mt-1.5 text-orange-100">
                  A $25 gift is a full trolley of weekly essentials for a family doing it tough.
                </p>
              </>
            )}
            <Link
              href="/give/again"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3.5 text-base font-bold text-white transition-transform active:scale-[0.98]"
            >
              <Heart className="h-5 w-5" /> Give now
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {hasGifts && (
              <Link
                href="/dashboard/giving"
                className="flex items-center justify-between rounded-[28px] border border-neutral-200 p-6 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
              >
                <span className="font-semibold">Giving &amp; receipts</span>
                <ArrowUpRight className="h-5 w-5 text-neutral-400" />
              </Link>
            )}
            {hasActiveRecurring && (
              <Link
                href="/dashboard/recurring"
                className="flex items-center justify-between rounded-[28px] border border-neutral-200 p-6 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Repeat className="h-4 w-4 text-orange-500" /> Recurring giving
                </span>
                <ArrowRight className="h-5 w-5 text-neutral-400" />
              </Link>
            )}
            {tithePlan && (
              <Link
                href="/dashboard/tithes"
                className="flex items-center justify-between rounded-[28px] border border-neutral-200 p-6 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
              >
                <span className="inline-flex items-center gap-2">
                  <Church className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">
                    Tithe {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(tithePlan.amount))}
                    {tithePlan.frequency ? ` · ${tithePlan.frequency}` : ''}
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 text-neutral-400" />
              </Link>
            )}
          </div>
        </section>

        {/* Appeals */}
        {appeals.length > 0 && (
          <section className="mt-12">
            <AppealsCarousel appeals={appeals} />
          </section>
        )}
      </div>
    </div>
  )
}
