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
    // Android only, and genuinely useful here: an installed web app can appear
    // in the system share sheet. Screenshot your step count, tap Share, pick
    // My Lighthouse, and the image goes straight to the reader. No opening the
    // portal and hunting for an upload button.
    //
    // iOS does not implement this, which is fine, because iOS has Shortcuts.
    share_target: {
      action: '/api/fitness/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [{ name: 'screenshot', accept: ['image/png', 'image/jpeg', 'image/webp'] }],
      },
    },
    icons: [
      { src: '/logo-square.png', sizes: '1083x1083', type: 'image/png', purpose: 'any' },
      { src: '/logo-square.png', sizes: '1083x1083', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
