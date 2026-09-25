import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canOpenSlhOrg, slhOrg } from '@/lib/slh'
import { formatDate } from '@/lib/utils'
import { EditFamily } from '@/components/slh/EditFamily'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Family', robots: { index: false } }

/**
 * Changing a family after they were nominated.
 *
 * Names get spelt wrong, phone numbers change, and a caseworker who typed
 * "Child 2" to get a nomination in needs to come back and say who that is.
 * Until now the organisation could see a family and never touch it.
 */
export default async function EditFamilyPage({
  params,
}: {
  params: Promise<{ id: string; familyId: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id, familyId } = await params
  if (!(await canOpenSlhOrg(id))) notFound()

  const [org, family] = await Promise.all([
    slhOrg(id),
    prisma.giftFamily.findFirst({
      where: { id: familyId, organisationId: id },
      include: { children: { orderBy: { createdAt: 'asc' } } },
    }),
  ])
  if (!org || !family) notFound()

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href={`/dashboard/slh/org/${org.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {org.name}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{family.guardianName}</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Nominated {formatDate(family.createdAt, 'd MMMM')}
          {family.consentAt ? ' · consent recorded' : ' · no consent recorded'}
        </p>

        <EditFamily
          organisationId={org.id}
          family={{
            id: family.id,
            guardianName: family.guardianName,
            guardianEmail: family.guardianEmail ?? '',
            guardianPhone: family.guardianPhone ?? '',
            notes: family.notes ?? '',
            shareToken: family.shareToken,
            shareOpenedAt: family.shareOpenedAt
              ? formatDate(family.shareOpenedAt, 'd MMMM')
              : null,
          }}
          childRows={family.children.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            dateOfBirth: c.dateOfBirth.toISOString().slice(0, 10),
            gender: c.gender,
            hasShopper: c.shopperId !== null,
            filled: Boolean(c.wishWant && c.wishNeed && c.wishWear && c.wishRead),
          }))}
        />
      </div>
    </div>
  )
}
