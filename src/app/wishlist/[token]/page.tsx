import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { bannedTerms } from '@/lib/wishlist-limits.server'
import { FamilyWishLists } from '@/components/slh/FamilyWishLists'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Your Christmas wish lists',
  // Never indexed. A page about somebody's children has no business in a
  // search result, however long the address is.
  robots: { index: false, follow: false },
}

/**
 * A family filling in their own children's wish lists.
 *
 * **The one public page in Santa's Little Helpers**, and the token is the
 * whole of its security — so what it shows is kept to the minimum that makes
 * the job possible: the children's first names and their wish lists. Not the
 * guardian's name, phone or address, not why they were nominated, not the
 * organisation's other families, not a way to reach anything else.
 *
 * One link per family, covering every child on it. A parent with three
 * children should not be sent three links and left wondering whether they did
 * the middle one.
 */
export default async function FamilyWishListPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const family = await prisma.giftFamily.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      guardianName: true,
      organisation: { select: { name: true } },
      program: { select: { name: true, nominationsCloseAt: true } },
      children: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          firstName: true,
          dateOfBirth: true,
          gender: true,
          favouriteColour: true,
          clothesBand: true,
          topSize: true,
          bottomSize: true,
          dressSize: true,
          clothesSize: true,
          shoesBand: true,
          shoesSize: true,
          interests: true,
          wishWant: true,
          wishNeed: true,
          wishWear: true,
          wishRead: true,
          storyText: true,
        },
      },
    },
  })

  // A withdrawn or mistyped link is a 404, not an explanation. Telling somebody
  // "that link has been withdrawn" confirms it once existed.
  if (!family) notFound()

  // Recorded so the organisation knows whether to chase. Deliberately not
  // awaited into the render path — a slow write should not hold up the page.
  void prisma.giftFamily
    .update({ where: { id: family.id }, data: { shareOpenedAt: new Date() } })
    .catch(() => {})

  const banned = await bannedTerms()

  return (
    <FamilyWishLists
      token={token}
      bannedTerms={banned}
      organisation={family.organisation.name}
      childRows={family.children.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        dateOfBirth: c.dateOfBirth.toISOString().slice(0, 10),
        gender: c.gender,
        values: {
          favouriteColour: c.favouriteColour ?? '',
          clothesBand: c.clothesBand ?? '',
          topSize: c.topSize ?? '',
          bottomSize: c.bottomSize ?? '',
          dressSize: c.dressSize ?? '',
          clothesSize: c.clothesSize ?? '',
          shoesBand: c.shoesBand ?? '',
          shoesSize: c.shoesSize ?? '',
          interests: c.interests,
          wishWant: c.wishWant ?? '',
          wishNeed: c.wishNeed ?? '',
          wishWear: c.wishWear ?? '',
          wishRead: c.wishRead ?? '',
          storyText: c.storyText ?? '',
        },
      }))}
    />
  )
}
