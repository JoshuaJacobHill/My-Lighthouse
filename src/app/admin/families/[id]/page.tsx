import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Check, Gift, Pencil } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { canReadFamilies, household, lastSupportByKind } from '@/lib/households'
import { HOUSEHOLD_STATUSES, RELATIONSHIPS } from '@/lib/households-core'
import { ageOn } from '@/lib/slh-steps'
import { SupportLog } from '@/components/families/SupportLog'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Family', robots: { index: false } }

/**
 * One household.
 *
 * Who they are, who is in the house, and what they have received — in that
 * order, because that is the order somebody needs them in when a family is on
 * the phone. Case notes and referrals have tables but no screens yet: the
 * retention rule and who may read a safeguarding note are decisions for a
 * person, and building the form first would mean a real disclosure sitting
 * under a rule nobody chose. See docs/features/FAMILIES.md.
 */
export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await params
  if (!session) redirect(`/login?next=/admin/families/${id}`)
  if (!(await canReadFamilies())) notFound()

  const [home, lastByKind] = await Promise.all([household(id), lastSupportByKind(id)])
  if (!home) notFound()

  const status = HOUSEHOLD_STATUSES.find(([v]) => v === home.status)

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/families"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Families
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-3xl font-extrabold tracking-tight">{home.name}</h1>
            {home.status !== 'ACTIVE' && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-bold text-neutral-500">
                {status?.[1]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {[home.address, home.suburb, home.postcode].filter(Boolean).join(', ') ||
              'No address recorded'}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {[home.phone, home.email].filter(Boolean).join(' · ') || 'No contact details'}
          </p>
        </div>
        <Link
          href={`/admin/families/${home.id}/edit`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-300 px-4 py-2 text-[13px] font-bold hover:bg-neutral-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
        </Link>
      </div>

      {home.consentAt ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-3.5 py-1.5 text-[13px] font-semibold text-green-800">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Consent recorded{' '}
          {new Date(home.consentAt).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'Australia/Brisbane',
          })}
          {home.consentByName ? ` by ${home.consentByName}` : ''}
        </p>
      ) : (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <b>No consent recorded.</b> They came to us for help, not to be catalogued — ask, then
          tick it on their record.
        </p>
      )}

      {home.standingNotes && (
        <div className="mt-5 rounded-[28px] bg-neutral-50 p-5">
          <b className="text-sm">Always true</b>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
            {home.standingNotes}
          </p>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">
          Who&rsquo;s in the house{' '}
          <span className="font-normal text-neutral-400">{home.members.length}</span>
        </h2>
        {home.members.length === 0 ? (
          <p className="mt-3 rounded-[28px] border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            Nobody added yet.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
            {home.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {[m.firstName, m.lastName].filter(Boolean).join(' ')}
                    {m.isPrimary && (
                      <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white">
                        CONTACT
                      </span>
                    )}
                  </span>
                  <span className="block text-[13px] text-neutral-400">
                    {[
                      RELATIONSHIPS.find(([v]) => v === m.relationship)?.[1],
                      m.dateOfBirth ? `${ageOn(m.dateOfBirth)} years old` : null,
                      // The link that stops this becoming a second database
                      // of people — see PURPOSE.md.
                      m.user ? `account: ${m.user.email}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {m.notes && (
                    <span className="mt-1 block text-[13px] text-neutral-500">{m.notes}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <SupportLog
        householdId={home.id}
        rows={home.support.map((s) => ({
          id: s.id,
          kind: s.kind,
          givenAt: s.givenAt.toISOString(),
          quantity: s.quantity,
          notes: s.notes,
          organisation: s.organisation?.name ?? null,
        }))}
        lastByKind={Object.fromEntries(
          Object.entries(lastByKind).map(([kind, date]) => [kind, date.toISOString()]),
        )}
      />

      {home.giftFamilies.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">Santa&rsquo;s Little Helpers</h2>
          <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-[28px] border border-neutral-200">
            {home.giftFamilies.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
                <Gift className="h-4 w-4 shrink-0 text-[#c8102e]" aria-hidden="true" />
                <span className="text-sm">
                  <b>{g.program.name}</b>
                  <span className="text-neutral-400">
                    {' '}
                    · {g._count.children}{' '}
                    {g._count.children === 1 ? 'child nominated' : 'children nominated'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 rounded-[28px] border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-500">
        Case notes and referrals have a home in the database but no screen yet — the retention
        rule and who may read a safeguarding note are decisions for a person first. See
        docs/features/FAMILIES.md.
      </p>
    </div>
  )
}
