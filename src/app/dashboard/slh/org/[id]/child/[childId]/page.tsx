import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canOpenSlhOrg, slhOrg } from '@/lib/slh'
import { ageOn } from '@/lib/slh-steps'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { WishListForm } from '@/components/slh/WishListForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Wish list', robots: { index: false } }

/**
 * Filling in one child's wish list.
 *
 * The organisation's screen, not the shopper's — so it shows the questions
 * rather than the answers, and it is the only place the four gifts, the
 * interests and the child's own words are entered.
 */
export default async function OrgWishListPage({
  params,
}: {
  params: Promise<{ id: string; childId: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id, childId } = await params
  if (!(await canOpenSlhOrg(id))) notFound()

  const [org, child] = await Promise.all([
    slhOrg(id),
    // Scoped to this organisation, so an admin of one referrer cannot open
    // another's child by guessing an id.
    prisma.giftChild.findFirst({
      where: { id: childId, organisationId: id },
      include: { family: { select: { guardianName: true } } },
    }),
  ])
  if (!org || !child) notFound()

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href={`/dashboard/slh/org/${org.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {org.name}
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <ChildAvatar
            gender={child.gender === 'girl' ? 'girl' : 'boy'}
            className="h-16 w-16 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight">{child.firstName}</h1>
            <p className="text-sm text-neutral-500">
              {child.gender === 'girl' ? 'Girl' : 'Boy'} age {ageOn(child.dateOfBirth)}
              {child.family ? ` · ${child.family.guardianName}` : ' · no family linked'}
            </p>
          </div>
        </div>

        <WishListForm
          organisationId={org.id}
          childId={child.id}
          childName={child.firstName}
          storyApproved={child.storyApproved}
          initial={{
            favouriteColour: child.favouriteColour ?? '',
            clothesBand: child.clothesBand ?? '',
            topSize: child.topSize ?? '',
            bottomSize: child.bottomSize ?? '',
            dressSize: child.dressSize ?? '',
            clothesSize: child.clothesSize ?? '',
            shoesBand: child.shoesBand ?? '',
            shoesSize: child.shoesSize ?? '',
            interests: child.interests,
            wishWant: child.wishWant ?? '',
            wishNeed: child.wishNeed ?? '',
            wishWear: child.wishWear ?? '',
            wishRead: child.wishRead ?? '',
            storyText: child.storyText ?? '',
          }}
        />
      </div>
    </div>
  )
}
