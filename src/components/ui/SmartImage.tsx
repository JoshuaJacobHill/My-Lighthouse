import Image from 'next/image'

// Hosts next/image is allowed to optimise — must stay in step with the
// `images.remotePatterns` allowlist in next.config.ts. Anything else (a
// sponsor's own CDN, say) renders as a plain <img> rather than throwing.
const OPTIMISABLE_HOSTS = [
  /\.public\.blob\.vercel-storage\.com$/i,
  /^(www\.)?lighthousecare\.org\.au$/i,
]

function canOptimise(src: string): boolean {
  // A path relative to /public is always safe for the optimiser — it's our own
  // file, served from our own origin.
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const url = new URL(src)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return OPTIMISABLE_HOSTS.some((re) => re.test(url.hostname))
  } catch {
    return false
  }
}

/**
 * Renders a remote image through next/image (automatic resizing + WebP/AVIF)
 * where that's possible, and falls back to a plain <img> where it isn't.
 *
 * The fallback matters: sponsor logos uploaded through the public checkout are
 * stored as data: URLs, which the image optimiser can't process, and any host
 * not listed in next.config's remotePatterns would throw at render time. A
 * sponsor's logo failing to render is worse than it not being optimised.
 */
export function SmartImage({
  src,
  alt,
  width,
  height,
  className,
  sizes,
  priority,
  fill,
}: {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  sizes?: string
  priority?: boolean
  fill?: boolean
}) {
  if (!canOptimise(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} loading={priority ? 'eager' : 'lazy'} />
  }

  if (fill) {
    return <Image src={src} alt={alt} fill sizes={sizes ?? '100vw'} className={className} priority={priority} />
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 200}
      height={height ?? 200}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  )
}
