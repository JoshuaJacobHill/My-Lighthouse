import type { MetadataRoute } from 'next'

/**
 * Web app manifest, so the portal installs to a phone's home screen properly
 * rather than as a plain Safari bookmark.
 *
 * `standalone` drops the browser chrome, which matters here because staff will
 * be opening this several times a day during the step challenge and it should
 * feel like an app rather than a web page they had to find.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Lighthouse Portal',
    short_name: 'My Lighthouse',
    description: 'Give, volunteer and see your impact with Lighthouse Care.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f97316',
    icons: [
      { src: '/logo-square.png', sizes: '1083x1083', type: 'image/png', purpose: 'any' },
      { src: '/logo-square.png', sizes: '1083x1083', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
