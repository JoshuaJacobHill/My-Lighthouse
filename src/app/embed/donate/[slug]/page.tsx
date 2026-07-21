import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Chrome-less so it sits cleanly inside an iframe on the WordPress site.
export const metadata = {
  title: 'Donate',
  robots: { index: false, follow: false },
}

const aud0 = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function Unavailable() {
  // Neutral, non-leaky fallback when a fund is missing or its public progress
  // is switched off. Keeps the iframe tidy rather than rendering a 404 page.
  return (
    <div className="px-4 py-3 text-sm text-gray-400">
      This appeal isn&rsquo;t available right now.
    </div>
  )
}

export default async function DonateEmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const fund = await prisma.fund.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, goalAmount: true, showPublicProgress: true, isActive: true },
  })

  if (!fund || !fund.showPublicProgress) return <Unavailable />

  const agg = await prisma.donation.aggregate({
    where: { fundId: fund.id },
    _sum: { amount: true },
  })
  const raised = Number(agg._sum.amount ?? 0)
  const goal = fund.goalAmount ? Number(fund.goalAmount) : null
  const pct = goal && goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null

  return (
    <div className="bg-transparent p-4">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{fund.name}</h2>
        {fund.description && (
          <p className="mt-1 text-sm text-gray-500">{fund.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-bold text-gray-900">{aud0.format(raised)}</span>
          <span className="text-sm text-gray-400">
            raised{goal ? ` of ${aud0.format(goal)} goal` : ''}
          </span>
        </div>

        {pct !== null && (
          <>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs font-medium text-orange-600">{pct}% of our goal</p>
          </>
        )}

        <a
          href={`/donate?fund=${slug}`}
          target="_top"
          className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Donate now
        </a>
      </div>
    </div>
  )
}
