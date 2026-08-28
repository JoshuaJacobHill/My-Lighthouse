import { redirect } from 'next/navigation'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { StoryForm } from '@/components/admin/StoryForm'
import { requireAnyCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Edit story | Lighthouse Care Admin' }

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAnyCapability(['care.stories', 'church.stories'])
  const { id } = await params
  const story = await prisma.story.findUnique({ where: { id } })
  // Someone with a direct link to a story from the other side of the house
  // shouldn't get the edit form; the save action refuses too, but there's no
  // reason to show them the content first.
  if (story && !me.held.includes(story.churchOnly ? 'church.stories' : 'care.stories')) {
    redirect('/admin/stories')
  }
  if (!story) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/stories"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to stories
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Edit story</h1>
      <StoryForm
        story={{
          id: story.id,
          title: story.title,
          slug: story.slug,
          category: story.category,
          excerpt: story.excerpt,
          imageUrl: story.imageUrl,
          externalUrl: story.externalUrl,
          isPublished: story.isPublished,
          churchOnly: story.churchOnly,
          staffOnly: story.staffOnly,
          sortOrder: story.sortOrder,
        }}
      />
    </div>
  )
}
