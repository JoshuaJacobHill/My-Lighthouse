import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toast'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

const OG_IMAGE = 'https://lighthousecare.org.au/wp-content/uploads/2026/08/Introducing-MyLighthouse-Banner.jpg'
const SHARE_DESCRIPTION =
  'Give, volunteer and stay connected with Lighthouse Care — affordable groceries and food relief for families across South East Queensland.'

export const metadata: Metadata = {
  metadataBase: new URL('https://my.lighthousecare.org.au'),
  title: {
    default: 'My Lighthouse Portal',
    template: '%s | Lighthouse Care',
  },
  description:
    'My Lighthouse Portal — give, volunteer and stay connected with Lighthouse Care, an Australian not-for-profit providing affordable groceries and food relief to families across South East Queensland.',
  keywords: ['Lighthouse Care', 'donate', 'volunteer', 'Logan', 'Queensland', 'charity', 'food relief'],
  authors: [{ name: 'Lighthouse Care' }],
  icons: {
    icon: '/Favicon.png',
    shortcut: '/Favicon.png',
    apple: '/Favicon.png',
  },
  openGraph: {
    siteName: 'My Lighthouse Portal',
    title: 'My Lighthouse Portal',
    description: SHARE_DESCRIPTION,
    url: 'https://my.lighthousecare.org.au',
    locale: 'en_AU',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1920, height: 885, alt: 'Introducing the My Lighthouse Portal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Lighthouse Portal',
    description: SHARE_DESCRIPTION,
    images: [OG_IMAGE],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-AU" className={inter.className}>
      <body className="min-h-screen flex flex-col antialiased">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
