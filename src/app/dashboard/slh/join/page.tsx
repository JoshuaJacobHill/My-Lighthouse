import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { activeProgram, canShopSlh, myShopper, orgsOpenToShoppers } from '@/lib/slh'
import { JoinFlow, type JoinOrg } from '@/components/slh/JoinFlow'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Santa’s Little Helpers', robots: { index: false } }

/**
 * Describe a drop-off window the way somebody would say it out loud.
 *
 * "1–12 December" when both dates share a month, "28 November – 12 December"
 * when they do not, and just the closing day when there is only one. Empty
 * when the organisation has not set the window yet, so the screens can leave
 * the line out rather than print a half sentence.
 */
function windowLabel(opens: Date | null, closes: Date | null): string | null {
  if (!opens && !closes) return null
  if (opens && !closes) return `from ${formatDate(opens, 'd MMMM')}`
  if (!opens && closes) return `by ${formatDate(closes, 'd MMMM')}`

  const sameMonth = formatDate(opens!, 'MMMM') === formatDate(closes!, 'MMMM')
  return sameMonth
    ? `${formatDate(opens!, 'd')}–${formatDate(closes!, 'd MMMM')}`
    : `${formatDate(opens!, 'd MMMM')} – ${formatDate(closes!, 'd MMMM')}`
}

/**
 * Signing up to shop.
 *
 * Somebody who has already signed up is sent to their wish lists instead —
 * onboarding is a door, not a place, and walking back through it should not
 * quietly rewrite what they chose.
 */
export default async function SlhJoinPage() {
  const session = await getSession()
  // lighthousecare.org.au/santa points straight here, so this is the one SLH
  // page a signed-out stranger is most likely to hit. Keep their destination.
  if (!session) redirect('/login?next=/dashboard/slh/join')
  // Lighthouse, or somebody who administers an approved referring
  // organisation. The shopper flow opens to everybody when the program does.
  if (!(await canShopSlh())) notFound()

  const program = await activeProgram()
  if (!program) notFound()

  if (await myShopper()) redirect('/dashboard/slh')

  const options = await orgsOpenToShoppers()
  const orgs: JoinOrg[] = options.map((o) => ({
    id: o.id,
    name: o.name,
    logoUrl: o.logoUrl,
    waiting: o.waiting,
    available: o.available,
    open: o.open,
    dropOffAddress: o.dropOffAddress,
    window: windowLabel(o.dropOffOpensAt, o.dropOffClosesAt),
  }))

  return (
    <JoinFlow
      orgs={orgs}
      year={program.year}
      pushPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
    />
  )
}
