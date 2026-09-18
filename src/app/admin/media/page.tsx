import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireCapability } from '@/lib/permissions'
import { listMedia, FOLDER_LABEL } from '@/lib/media-library'
import { MediaLibrary } from '@/components/media/MediaLibrary'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Media library' }

/**
 * One library for every image the organisation publishes.
 *
 * Events, stories, fundraisers, appeals, sponsors and anything uploaded for
 * marketing, in one grid — because a good photo from the Good Food Festival
 * should be usable in an advertisement without being uploaded a second time.
 *
 * Volunteers' avatars are deliberately not here. A picture somebody uploaded of
 * themselves for their profile is not stock for an ad.
 */
export default async function MediaLibraryPage() {
  await requireCapability('business.reports')
  const items = await listMedia()

  const counts = items.reduce<Record<string, number>>((acc, m) => {
    acc[m.label] = (acc[m.label] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link
        href="/dashboard/business"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Sales &amp; marketing
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Media library</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-neutral-500">
        Every image the team has uploaded — events, stories, fundraisers, appeals and marketing —
        in one place, so a good photo can be used wherever it fits. Anything here can go into a
        post or an ad.
      </p>

      {Object.keys(counts).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(counts).map(([label, n]) => (
            <span
              key={label}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600"
            >
              {label} · {n}
            </span>
          ))}
        </div>
      )}

      <div className="mt-7">
        <MediaLibrary initial={items} />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[28px] bg-neutral-50 p-6 text-sm leading-relaxed text-neutral-600">
          <p className="font-bold text-neutral-900">Name them well</p>
          <p className="mt-2">
            The assistant can read filenames but cannot see the pictures. So
            &ldquo;trolley-mangoes-sept.jpg&rdquo; gets suggested sensibly and
            &ldquo;IMG_4471.jpg&rdquo; never does. You always see the real image on the approval
            card before anything is published.
          </p>
        </div>
        <div className="rounded-[28px] bg-neutral-50 p-6 text-sm leading-relaxed text-neutral-600">
          <p className="font-bold text-neutral-900">What is not here</p>
          <p className="mt-2">
            Volunteers&rsquo; profile photos, and partner logos. Those belong to the people and
            companies who uploaded them and are managed on their own pages, not treated as stock.
          </p>
        </div>
      </div>

      <p className="mt-8 text-xs text-neutral-400">
        Folders: {Object.values(FOLDER_LABEL).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.
        New uploads from this page land in General.
      </p>
    </div>
  )
}
