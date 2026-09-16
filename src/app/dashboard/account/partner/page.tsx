import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { corporateDomain } from '@/lib/organisations'
import { ApplyForm } from './ApplyForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your company' }

const STATUS_COPY: Record<string, string> = {
  PENDING: 'We have your request and will come back to you here.',
  ACTIVE: 'Approved.',
  DECLINED: 'This request was not approved.',
}

export default async function AccountPartnerPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [me, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, emailVerified: true },
    }),
    prisma.orgMember.findMany({
      where: { userId: session.userId },
      include: {
        organisation: {
          select: { id: true, name: true, slug: true, status: true, isPublished: true, reviewNote: true },
        },
      },
    }),
  ])

  const hasCompanyDomain = Boolean(corporateDomain(me?.email))

  return (
    <div className="-m-4 min-h-full bg-white lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/account"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Account
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Your company</h1>
        <p className="mt-2 text-neutral-500">
          Businesses that support us can have a profile showing what they have done — sponsorships,
          appeals, volunteering days.
        </p>

        {memberships.length > 0 && (
          <ul className="mt-7 space-y-3">
            {memberships.map((m) => (
              <li key={m.id} className="rounded-[28px] border border-neutral-200 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-bold text-neutral-900">{m.organisation.name}</span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600">
                    {m.role.toLowerCase()}
                  </span>
                  {m.status === 'PENDING' && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      waiting
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  {STATUS_COPY[m.organisation.status] ?? ''}
                  {m.organisation.status === 'DECLINED' && m.organisation.reviewNote
                    ? ` ${m.organisation.reviewNote}`
                    : ''}
                </p>
                {m.organisation.status === 'ACTIVE' && m.organisation.isPublished && (
                  <Link
                    href={`/partners/${m.organisation.slug}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline"
                  >
                    See the page
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        {memberships.length === 0 && (
          <div className="mt-7">
            {me?.emailVerified ? (
              <ApplyForm hasCompanyDomain={hasCompanyDomain} />
            ) : (
              <p className="rounded-[28px] bg-amber-50 p-5 leading-relaxed text-amber-900">
                Please confirm your email address first — check your inbox for our verification
                link. An address nobody has proved they own is not something we can act on.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
