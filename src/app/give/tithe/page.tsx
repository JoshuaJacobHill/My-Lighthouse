import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { resolveAccount } from '@/lib/stripe-accounts'
import { DonateForm } from '@/app/donate/DonateForm'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Give your tithe — Lighthouse Family Church',
  robots: { index: false }, // church-only, reached via the church website link
}

const CHURCH_FUND_SLUG = 'lighthouse-family-church'

// Tithes flow — reached only via the church website link (not surfaced in the
// app). Same clean giving interface; gifts are tagged as tithes and settle to
// the CHURCH account.
export default async function TithePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>
}) {
  const { cancelled } = await searchParams

  const fund = await prisma.fund.findFirst({
    where: { slug: CHURCH_FUND_SLUG, isActive: true },
    select: {
      slug: true,
      name: true,
      depositAccount: true,
      presetAmounts: true,
      suggestedAmount: true,
      impactLabels: true,
      defaultFrequency: true,
    },
  })
  if (!fund) notFound()

  const session = await getSession()
  const currentUser = session
    ? await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } })
    : null

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <a href="https://lighthousefamilychurch.org.au">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-inline-black.png" alt="Lighthouse" className="h-7 w-auto" />
          </a>
          <a href="/login" className="text-sm text-neutral-500">
            Have an account? <span className="font-semibold text-orange-600">Sign in</span>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">Give your tithe</h1>
          <p className="mt-2 text-neutral-500">
            Thank you for your faithfulness. Give a one-off or set up your regular tithe below — you can manage it any
            time from your account.
          </p>

          {cancelled && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              No payment was made — your tithe was cancelled. You’re welcome to try again below.
            </div>
          )}

          <div className="mt-6">
            <DonateForm
              fundSlug={fund.slug}
              fundName="Lighthouse Family Church"
              accountKey={resolveAccount(fund.depositAccount)}
              initialName={currentUser?.name ?? undefined}
              initialEmail={currentUser?.email ?? undefined}
              presets={fund.presetAmounts}
              suggested={fund.suggestedAmount}
              impactLabels={(fund.impactLabels as Record<string, string> | null) ?? undefined}
              defaultFrequency={fund.defaultFrequency ?? 'weekly'}
              isTithe
              showPresets={false}
              showCompany={false}
              showMessage={false}
            />
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-sm text-center text-xs text-neutral-400">
          Payments are processed securely by Stripe. You can update or cancel your tithe any time from your account.
        </p>
      </div>
    </main>
  )
}
