import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import prisma from '@/lib/prisma'
import { shareMetadata } from '@/lib/share-metadata'

export const dynamic = 'force-dynamic'

/**
 * A good news story, on a page anybody can open.
 *
 * Stories already existed, but only inside the portal at /dashboard/news —
 * behind a sign-in. So sharing one meant sharing a link that asked strangers
 * to log in, and previewed with the generic site banner because there was no
 * public page for a scraper to read.
 *
 * Only genuinely public stories reach here. A story marked church-only or
 * staff-only is not public content with a narrower audience — it is private
 * content, and this route must never be the way around that.
 */
async function publicStory(slug: string) {
  return prisma.story.findFirst({
    where: { slug, isPublished: true, churchOnly: false, staffOnly: false },
    select: {
      title: true,
      category: true,
      excerpt: true,
      imageUrl: true,
      externalUrl: true,
      publishedAt: true,
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const story = await publicStory(slug)
  if (!story) return { title: 'Story | Lighthouse Care' }

  return shareMetadata({
    title: story.title,
    description: story.excerpt,
    imageUrl: story.imageUrl,
    path: `/stories/${slug}`,
    type: 'article',
  })
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const story = await publicStory(slug)
  if (!story) notFound()

  // Where the full article lives on the main site, send the reader there —
  // but only after the metadata above has been generated, so a shared link
  // still previews with this story's own picture rather than whatever the
  // blog happens to serve.
  if (story.externalUrl) redirect(story.externalUrl)

  const when = story.publishedAt
    ? new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        dateStyle: 'long',
      }).format(story.publishedAt)
    : null

  return (
    <article className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Lighthouse Care
      </Link>

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-orange-600">
        {story.category}
      </p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{story.title}</h1>
      {when && <p className="mt-2 text-sm text-neutral-500">{when}</p>}

      {story.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.imageUrl}
          alt=""
          className="mt-8 w-full rounded-[28px] border border-neutral-200 object-cover"
        />
      )}

      {story.excerpt && (
        <div className="mt-8 whitespace-pre-line text-lg leading-relaxed text-neutral-700">
          {story.excerpt}
        </div>
      )}

      <div className="mt-12 rounded-[28px] bg-neutral-50 p-6 sm:p-8">
        <h2 className="text-xl font-extrabold tracking-tight">
          Every dollar of profit goes back into food relief
        </h2>
        <p className="mt-2 leading-relaxed text-neutral-600">
          Lighthouse Care runs two discount grocery stores so families doing it tough can fill a
          trolley for $25. You can help with a gift, or a few hours.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/donate"
            className="inline-flex rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Give today
          </Link>
          <Link
            href="/volunteer/apply"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            Volunteer
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
