import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { SantaMark } from '@/components/slh/SantaMark'
import { activeProgram, canShopSlh, myShopper, orgsOpenToShoppers } from '@/lib/slh'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Santa’s Little Helpers', robots: { index: false } }

/**
 * What Santa's Little Helpers is, for somebody who has only seen the card.
 *
 * Most people who land here arrived by tapping a red tile on their dashboard
 * with no idea what it is. Sending them straight into a sign-up flow asks them
 * to commit before they have been told what they are committing to — around
 * $200 and a drive across Logan in December.
 *
 * Anybody who followed lighthousecare.org.au/santa has already read all this,
 * so that link points straight at `/dashboard/slh/join` and skips the page.
 * The separation is the URL itself rather than anything clever: one address
 * explains, the other signs you up.
 */
export default async function SlhAboutPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/dashboard/slh/about')
  if (!(await canShopSlh())) notFound()

  // Somebody already signed up does not need the pitch.
  if (await myShopper()) redirect('/dashboard/slh')

  const [program, orgs] = await Promise.all([activeProgram(), orgsOpenToShoppers()])
  if (!program) notFound()

  const waiting = orgs.reduce((n, o) => n + o.available, 0)

  const steps = [
    {
      title: 'A local organisation nominates a child',
      body: 'Refuges, schools and community services who already walk alongside these families, and who know which children would otherwise wake up to nothing.',
    },
    {
      title: 'You choose an organisation',
      body: 'You choose from a list of trusted organisations you would like to shop for.',
    },
    {
      title: 'You get their wish list',
      body: 'Their first name, their age, what they are into, and what they would love. We ask for around $200 to be spent, so every child receives the same care.',
    },
    {
      title: 'You shop and wrap',
      body: 'In your own time, at your own pace. Tick each step off here as you go so we know the list is in safe hands.',
    },
    {
      title: 'You drop the gifts back',
      body: 'To the organisation you chose, inside their drop-off window. They hand them to the family, because they are the ones the family already trusts.',
    },
  ]

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Home
        </Link>

        <div className="mt-4 overflow-hidden rounded-[28px] bg-[#c8102e] p-4">
          <div className="grid justify-items-center gap-2 rounded-[18px] bg-white px-4 py-7">
            <SantaMark className="h-14 w-14" />
            <p className="text-2xl font-extrabold leading-none tracking-tight text-[#c8102e]">
              SANTA&rsquo;S
            </p>
            <p className="text-[11px] font-bold tracking-[0.22em] text-neutral-900">
              LITTLE HELPERS
            </p>
          </div>
        </div>

        <h1 className="mt-7 text-3xl font-extrabold leading-tight tracking-tight">
          Be the reason a child wakes up to something this Christmas
        </h1>
        <div className="mt-4 space-y-3.5 text-[15px] leading-relaxed text-neutral-600">
          <p>
            Every year there are children whose families are doing it tough — and for whom
            Christmas morning is a day to get through rather than look forward to.
          </p>
          <p>
            Santa&rsquo;s Little Helpers matches those children with people like you. You shop for
            one child, or a few, and on Christmas morning they open presents chosen for them by
            somebody who has never met them.
          </p>
        </div>

        <h2 className="mt-8 text-lg font-bold tracking-tight">How it works</h2>
        <ol className="mt-3 grid gap-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#c8102e] text-[13px] font-extrabold text-white">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{step.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-neutral-500">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-[28px] border-2 border-[#c8102e] p-6 text-center">
          <p className="text-lg font-extrabold tracking-tight">
            Would you like to shop for a child this Christmas?
          </p>
          {waiting > 0 && (
            <p className="mt-1.5 text-sm text-neutral-500">
              {waiting} {waiting === 1 ? 'child is' : 'children are'} waiting for a shopper across{' '}
              {orgs.filter((o) => o.open && o.available > 0).length}{' '}
              {orgs.filter((o) => o.open && o.available > 0).length === 1
                ? 'organisation'
                : 'organisations'}
              .
            </p>
          )}
          <Link
            href="/dashboard/slh/join"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c8102e] px-7 py-3.5 text-base font-bold text-white hover:bg-[#9d0b23]"
          >
            Yes, sign me up <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-3 text-xs text-neutral-400">
            You choose the organisation and how many children, and you can change your mind later.
          </p>
        </div>
      </div>
    </div>
  )
}
