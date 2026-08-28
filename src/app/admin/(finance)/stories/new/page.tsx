import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StoryForm } from '@/components/admin/StoryForm'
import { requireAnyCapability } from '@/lib/permissions'

export const metadata = { title: 'New story | Lighthouse Care Admin' }

export default async function NewStoryPage() {
  await requireAnyCapability(['care.stories', 'church.stories'])
  return (
    <div className="space-y-6">
      <Link
        href="/admin/stories"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to stories
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">New story</h1>
      <StoryForm />
    </div>
  )
}
