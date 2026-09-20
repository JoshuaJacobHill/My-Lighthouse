import type { Metadata } from 'next'

/**
 * What a link to one of our pages looks like when somebody shares it.
 *
 * Every public page was inheriting the site-wide banner from the root layout,
 * so a Good Food Festival event, a Christmas appeal and a fundraiser all
 * previewed as the same generic graphic. The picture is most of what decides
 * whether a shared link gets opened, and a fundraiser has a perfectly good one
 * already on the page.
 *
 * Three things worth knowing if you touch this:
 *
 *   The image must be an absolute URL. Facebook and LinkedIn fetch it from
 *   their own servers, so a path relative to the site resolves to nothing.
 *   Blob URLs already are absolute; `metadataBase` in the root layout covers
 *   anything else.
 *
 *   `summary_large_image` is what makes X show the big picture rather than a
 *   thumbnail beside the text. Without it the image is there and nobody
 *   notices it.
 *
 *   Facebook caches a preview per URL, for a long time. Changing a featured
 *   image will not change an already-shared link until the cache is cleared
 *   in Meta's Sharing Debugger.
 */

const SITE = 'My Lighthouse Portal'

/** The banner a page falls back to when it has no picture of its own. */
export const DEFAULT_SHARE_IMAGE =
  'https://lighthousecare.org.au/wp-content/uploads/2026/08/Introducing-MyLighthouse-Banner.jpg'

export type ShareInput = {
  title: string
  description?: string | null
  /** The page's own featured image. Falls back to the site banner. */
  imageUrl?: string | null
  /** Absolute or site-relative, e.g. `/fundraisers/backyard-blitz`. */
  path: string
  type?: 'website' | 'article'
}

/** Trim a description to something a preview card will actually show. */
function blurb(text: string | null | undefined, fallback: string): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  return clean.length > 200 ? `${clean.slice(0, 197).trimEnd()}…` : clean
}

/**
 * Metadata for a shareable page.
 *
 * Returns the whole `openGraph` and `twitter` blocks rather than patching the
 * root layout's: Next merges metadata shallowly, so returning a partial
 * `openGraph` replaces the parent's entirely anyway. Spelling it out means
 * what you read here is what gets rendered.
 */
export function shareMetadata(input: ShareInput): Metadata {
  const description = blurb(
    input.description,
    'Lighthouse Care — affordable groceries and food relief for families across South East Queensland.',
  )
  const image = input.imageUrl?.trim() || DEFAULT_SHARE_IMAGE
  const url = input.path.startsWith('http')
    ? input.path
    : `https://my.lighthousecare.org.au${input.path.startsWith('/') ? '' : '/'}${input.path}`

  return {
    title: input.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      siteName: SITE,
      title: input.title,
      description,
      url,
      locale: 'en_AU',
      type: input.type ?? 'website',
      // No width or height: these are photographs people upload at whatever
      // size they happen to be, and stating dimensions we have not measured
      // would be a guess that the scrapers then believe.
      images: [{ url: image, alt: input.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description,
      images: [image],
    },
  }
}

/**
 * A share image chosen by us for a page that has no featured image of its own.
 *
 * Volunteering and the contact page are not "a fundraiser" — there is no
 * record with a picture attached, so somebody has to pick one. Kept in
 * AppSetting rather than hard-coded here, because the right photo for "come
 * and volunteer" changes with the season and should not need a deploy.
 *
 * Set `share.image.volunteer` (or `.contact`) to any URL from the media
 * library. With nothing set, the page falls back to the site banner, which is
 * what it did before — so an unset key is never a broken page.
 */
export async function shareImageSetting(key: string): Promise<string | null> {
  const { default: prisma } = await import('@/lib/prisma')
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: `share.image.${key}` },
      select: { value: true },
    })
    return row?.value?.trim() || null
  } catch {
    // A share image is not worth failing a page render over.
    return null
  }
}
