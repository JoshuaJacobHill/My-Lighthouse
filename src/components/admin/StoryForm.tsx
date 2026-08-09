'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createStoryAction, updateStoryAction } from '@/lib/actions/story.actions'
import type { StoryInput } from '@/lib/validations'

export interface StoryFormValues {
  id: string
  title: string
  slug: string
  category: string
  excerpt: string | null
  imageUrl: string | null
  externalUrl: string | null
  isPublished: boolean
  churchOnly: boolean
  sortOrder: number
}

const CATEGORIES = ['Good news', 'Story', 'Update']

export function StoryForm({ story }: { story?: StoryFormValues }) {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const input: StoryInput = {
      title: String(fd.get('title') ?? ''),
      slug: String(fd.get('slug') ?? ''),
      category: String(fd.get('category') ?? 'Good news'),
      excerpt: String(fd.get('excerpt') ?? ''),
      imageUrl: String(fd.get('imageUrl') ?? ''),
      externalUrl: String(fd.get('externalUrl') ?? ''),
      isPublished: fd.get('isPublished') === 'on',
      churchOnly: fd.get('churchOnly') === 'on',
      sortOrder: String(fd.get('sortOrder') ?? '0'),
    }
    const res = story ? await updateStoryAction(story.id, input) : await createStoryAction(input)
    if (res.success) {
      router.push('/admin/stories')
      router.refresh()
    } else {
      setError(res.error ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Input label="Title" name="title" defaultValue={story?.title} required maxLength={160} />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
        <select
          name="category"
          defaultValue={story?.category ?? 'Good news'}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Story</label>
        <textarea
          name="excerpt"
          defaultValue={story?.excerpt ?? ''}
          rows={12}
          placeholder="Write the full story here — it shows when someone opens the card. No length limit."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        />
      </div>

      <Input
        label="Image URL"
        name="imageUrl"
        defaultValue={story?.imageUrl ?? ''}
        placeholder="https://…"
        hint="Optional. Paste an image URL (e.g. from your website's media library)."
      />
      <Input
        label="Link to full article"
        name="externalUrl"
        defaultValue={story?.externalUrl ?? ''}
        placeholder="https://lighthousecare.org.au/…"
        hint="Optional. Where 'read more' takes the reader — usually your blog."
      />
      <Input label="Sort order" name="sortOrder" type="number" defaultValue={String(story?.sortOrder ?? 0)} hint="Lower numbers show first." />
      <Input label="Slug" name="slug" defaultValue={story?.slug ?? ''} placeholder="auto-generated from the title" />

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={story?.isPublished ?? false}
          className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-sm font-medium text-gray-700">Published (visible on the dashboard)</span>
      </label>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="churchOnly"
          defaultChecked={story?.churchOnly ?? false}
          className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-sm font-medium text-gray-700">Church only (only church members see this)</span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : story ? 'Save changes' : 'Create story'}
        </Button>
        <Link href="/admin/stories" className="text-sm font-medium text-gray-500 hover:text-gray-700">
          Cancel
        </Link>
      </div>
    </form>
  )
}
