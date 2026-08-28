import Link from 'next/link'
import { Plus, ExternalLink } from 'lucide-react'
import prisma from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { DeleteStoryButton } from '@/components/admin/DeleteStoryButton'
import { requireAnyCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Good News & Stories | Lighthouse Care Admin' }

export default async function StoriesPage() {
  const me = await requireAnyCapability(['care.stories', 'church.stories'])
  // Only the audiences this admin writes for. A church manager sees church
  // stories, a care manager sees the rest; a general admin sees both.
  const seesCare = me.held.includes('care.stories')
  const seesChurch = me.held.includes('church.stories')
  const stories = await prisma.story.findMany({
    where: seesCare && seesChurch ? {} : { churchOnly: seesChurch },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good News &amp; Stories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Content shown on the donor dashboard.</p>
        </div>
        <Link
          href="/admin/stories/new"
          className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" /> New story
        </Link>
      </div>

      {stories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No stories yet.{' '}
          <Link href="/admin/stories/new" className="font-medium text-orange-600 hover:underline">
            Add your first one
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {stories.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/admin/stories/${s.id}/edit`} className="font-medium text-gray-900 hover:text-orange-600">
                      {s.title}
                    </Link>
                    {s.externalUrl && (
                      <a
                        href={s.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{s.category}</td>
                  <td className="px-5 py-3">
                    {s.isPublished ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(s.updatedAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/stories/${s.id}/edit`}
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        Edit
                      </Link>
                      <DeleteStoryButton storyId={s.id} title={s.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
