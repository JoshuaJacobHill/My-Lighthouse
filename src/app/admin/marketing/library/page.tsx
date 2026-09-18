import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireCapability } from '@/lib/permissions'
import { listMarketingAssetsAction } from '@/lib/actions/marketing.actions'
import { AssetManager } from '../AssetManager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Media library' }

/**
 * The image library, on its own page.
 *
 * It began at the bottom of the approval queue, below a list that grows, which
 * meant that on any day with proposals waiting it was somewhere nobody would
 * find. A thing the assistant depends on should not be reachable only by
 * scrolling past something else.
 */
export default async function MediaLibraryPage() {
  await requireCapability('business.reports')
  const assets = await listMarketingAssetsAction()

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link
        href="/dashboard/business"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Sales &amp; marketing
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Media library</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-neutral-500">
        Images the assistant can put in a post or an ad. Everything here is publicly reachable by
        URL once uploaded — Instagram and Meta fetch the picture themselves rather than accepting an
        upload, so anything you put here should be fine to be public.
      </p>

      <AssetManager initial={assets} />

      <div className="mt-10 rounded-[28px] bg-neutral-50 p-6 text-sm leading-relaxed text-neutral-600">
        <p className="font-bold text-neutral-900">If an upload does not appear</p>
        <p className="mt-2">
          PNG, JPEG and WebP only, up to 8MB — those are Meta&rsquo;s limits, not ours, and anything
          else is refused with a message rather than failing quietly. Very large photos straight off
          a phone are the usual culprit.
        </p>
      </div>
    </div>
  )
}
