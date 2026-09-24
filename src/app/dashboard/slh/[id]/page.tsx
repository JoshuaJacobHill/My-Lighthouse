import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { ChildAvatar } from '@/components/slh/ChildAvatar'
import { StepList } from '@/components/slh/StepList'
import { canShopSlh, myShopper, wishListForViewer } from '@/lib/slh'
import { ageOn, doneSteps } from '@/lib/slh-steps'
import { WISH_KINDS, clothingSummary, sizeLabel } from '@/lib/slh-wishlist'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Wish list', robots: { index: false } }

/**
 * One child's wish list, and the chain of steps for it.
 *
 * Interests and the child's own words come before the four gifts on purpose:
 * they are what turns a list of items into a person to shop for. The story only
 * appears once somebody at Lighthouse has approved it — a child writing freely
 * may say something identifying or distressing, so unapproved means unseen.
 *
 * A super admin can read any list while this is in preview, but only the
 * shopper it belongs to can tick the steps.
 */
export default async function WishListPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Lighthouse, or somebody who administers an approved referring
  // organisation. The shopper flow opens to everybody when the program does.
  if (!(await canShopSlh())) notFound()

  const { id } = await params
  const child = await wishListForViewer(id)
  if (!child) notFound()

  const shopper = await myShopper()
  const mine = Boolean(shopper && child.shopperId === shopper.id)

  const clothes = clothingSummary(child)
  const shoes = sizeLabel(child.shoesBand, child.shoesSize)

  const gifts: Record<string, string | null> = {
    want: child.wishWant,
    need: child.wishNeed,
    wear: child.wishWear,
    read: child.wishRead,
  }

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href="/dashboard/slh"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Your wish lists
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <ChildAvatar
            gender={child.gender === 'girl' ? 'girl' : 'boy'}
            className="h-20 w-20 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight">{child.firstName}</h1>
            <p className="text-sm text-neutral-500">
              {child.gender === 'girl' ? 'Girl' : 'Boy'} age {ageOn(child.dateOfBirth)}
              {child.favouriteColour ? ` · ${child.favouriteColour} is their favourite` : ''}
            </p>
          </div>
        </div>

        {child.interests.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {child.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-[13px] font-semibold"
              >
                {interest}
              </span>
            ))}
          </div>
        )}

        {/* Approved, or not shown. The default is that nobody has read it yet. */}
        {child.storyApproved && child.storyText && (
          <figure className="mt-5 rounded-[28px] bg-neutral-50 px-5 py-4">
            <blockquote className="text-[15px] italic leading-relaxed">
              &ldquo;{child.storyText}&rdquo;
            </blockquote>
            <figcaption className="mt-2.5 text-xs text-neutral-400">
              {child.firstName}, in their own words
            </figcaption>
          </figure>
        )}

        {/* The band carries the meaning: "Size 4" is a different child in
            toddler than in youth, and a shopper is standing in a shop. */}
        {(clothes || shoes) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {clothes && (
              <span className="rounded-xl bg-neutral-50 px-3 py-1.5 text-[13px] text-neutral-500">
                Clothes <b className="font-bold text-neutral-900">{clothes}</b>
              </span>
            )}
            {shoes && (
              <span className="rounded-xl bg-neutral-50 px-3 py-1.5 text-[13px] text-neutral-500">
                Shoes <b className="font-bold text-neutral-900">{shoes}</b>
              </span>
            )}
          </div>
        )}

        <div className="mt-6 divide-y divide-neutral-100 border-t border-neutral-100">
          {WISH_KINDS.map(([key, label]) => (
            <div key={key} className="py-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#c8102e]">
                {label}
              </p>
              <p className="mt-1 text-[17px] font-medium leading-snug">
                {gifts[key] ?? (
                  <span className="text-neutral-400">Not filled in yet</span>
                )}
              </p>
            </div>
          ))}
        </div>

        <p className="rounded-[28px] bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-600">
          Around <b className="font-bold text-neutral-900">$200</b> across the four gifts. Please
          leave price tags off, and keep everything for {child.firstName} in one bag.
        </p>

        <h2 className="mt-8 text-lg font-bold tracking-tight">Your steps</h2>
        {!mine && (
          <p className="mt-1 text-sm text-neutral-500">
            This list belongs to another shopper — you can read it, but not tick it off.
          </p>
        )}
        <StepList childId={child.id} done={doneSteps(child)} readOnly={!mine} />

        <p className="mt-8 text-center text-xs text-neutral-400">
          Nominated by {child.organisation.name}
        </p>
      </div>
    </div>
  )
}
