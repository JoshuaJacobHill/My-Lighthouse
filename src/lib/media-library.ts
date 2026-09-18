import { list } from '@vercel/blob'

/**
 * One library for every image the organisation publishes.
 *
 * There were two upload paths before this: the long-standing one behind
 * `uploadImageAction`, used by events, fundraisers, funds, sponsors and
 * stories, and a second one built for the marketing assistant. Two libraries
 * meant a photo from the Good Food Festival could go on an event page but not
 * into an ad, which is exactly backwards — a good photo is a good photo.
 *
 * So this reads across all of them. Uploading still goes through
 * `uploadImageAction`, which sniffs the file's magic bytes rather than
 * trusting the browser's content type and refuses SVG outright because SVG can
 * carry script.
 *
 * Two prefixes are deliberately NOT in the library:
 *
 *   avatars/        volunteers' own faces. A picture somebody uploaded of
 *                   themselves for their staff profile is not stock for an
 *                   advertisement, and nothing should be able to treat it as
 *                   though it were.
 *   partner-logos/  a company's mark, managed on that company's own page and
 *                   theirs rather than ours to place.
 */

/** Where content images live. The library is the union of these. */
export const MEDIA_FOLDERS = [
  'media',
  'uploads',
  'events',
  'fundraisers',
  'funds',
  'sponsors',
  'stories',
  // Kept so images uploaded before the libraries were merged stay visible.
  'marketing-assets',
] as const

export const FOLDER_LABEL: Record<string, string> = {
  media: 'General',
  uploads: 'General',
  events: 'Events',
  fundraisers: 'Fundraisers',
  funds: 'Appeals',
  sponsors: 'Sponsors',
  stories: 'Stories',
  'marketing-assets': 'Marketing',
}

/** Never in the library, whatever else changes. */
const PRIVATE_PREFIXES = ['avatars/', 'partner-logos/']

export type MediaItem = {
  url: string
  name: string
  folder: string
  label: string
  size: number
  uploadedAt: string
}

/**
 * Whether a URL is an image from our library that may be published.
 *
 * The check that stands between "the assistant picked something from the
 * library" and "the assistant published a URL it was handed". Excluding the
 * private prefixes here rather than only in the listing matters: the listing
 * decides what someone is shown, and this decides what can actually go out.
 */
export function isPublishableMedia(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (!parsed.hostname.endsWith('.blob.vercel-storage.com')) return false

  const path = parsed.pathname.replace(/^\/+/, '')
  if (PRIVATE_PREFIXES.some((p) => path.startsWith(p))) return false
  return MEDIA_FOLDERS.some((f) => path.startsWith(`${f}/`))
}

/**
 * Everything in the library, newest first.
 *
 * One call per folder because Blob filters by a single prefix, and the folders
 * are few and known. Ordered by upload time so the picture someone just added
 * is the first one they see.
 */
export async function listMedia(limit = 200): Promise<MediaItem[]> {
  const perFolder = Math.max(20, Math.floor(limit / MEDIA_FOLDERS.length))

  const batches = await Promise.all(
    MEDIA_FOLDERS.map(async (folder) => {
      try {
        const res = await list({ prefix: `${folder}/`, limit: perFolder })
        return res.blobs.map((b) => ({
          url: b.url,
          name: b.pathname.replace(`${folder}/`, ''),
          folder,
          label: FOLDER_LABEL[folder] ?? folder,
          size: b.size,
          uploadedAt: b.uploadedAt.toISOString(),
        }))
      } catch {
        // A folder that has never been written to is not an error, and one
        // unreadable prefix should not blank the whole library.
        return []
      }
    }),
  )

  const seen = new Set<string>()
  return batches
    .flat()
    .filter((m) => (seen.has(m.url) ? false : (seen.add(m.url), true)))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, limit)
}
