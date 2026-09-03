import { redirect } from 'next/navigation'
import { Newspaper } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { StoriesGrid } from '@/components/donor/StoriesGrid'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'News & updates' }

/**
 * The full run of stories. The dashboard shows the latest handful; this is the
 * whole lot, and it's where the staff "News" tab lands.
 *
 * Audience filtering matches the dashboard exactly: church-only stories need
 * church membership, staff-only updates need staff or trainee. Getting this
 * wrong here would quietly publish internal updates to every supporter.
 */
export default async function NewsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Came back with the session; this used to be a second serial query.
  const user = session.user

  const isStaffOrTrainee = user.isStaff || user.isTrainee
  const stories = await prisma.story.findMany({
    where: {
      isPublished: true,
      ...(user.isChurchMember ? {} : { churchOnly: false }),
      ...(isStaffOrTrainee ? {} : { staffOnly: false }),
    },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    take: 60,
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      excerpt: true,
      imageUrl: true,
      externalUrl: true,
    },
  })

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
          News &amp; <span className="font-extrabold">updates</span>
        </h1>
        <p className="mt-2 text-neutral-500">
          {isStaffOrTrainee
            ? 'Everything from around Lighthouse, including staff-only updates.'
            : 'Everything happening around Lighthouse.'}
        </p>

        {stories.length > 0 ? (
          <div className="mt-8">
            <StoriesGrid stories={stories} />
          </div>
        ) : (
          <section className="mt-8 rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-orange-400" aria-hidden="true" />
            <p className="mt-3 text-neutral-600">No news just yet — check back soon.</p>
          </section>
        )}
      </div>
    </div>
  )
}
