import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Sign In',
}

// Fallback when no image is set in admin (Settings → General → Login Page Image).
const DEFAULT_HERO = '/fundraisers/good-food-box.png'

const CONTACT_URL = 'https://lighthousecare.org.au/contact/'

async function getHeroImage(): Promise<string> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'login_hero_image_url' },
      select: { value: true },
    })
    return setting?.value?.trim() || DEFAULT_HERO
  } catch {
    return DEFAULT_HERO
  }
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const heroSrc = await getHeroImage()

  return (
    <div className="min-h-screen w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left: photo panel (desktop only) — image + headline, nothing else ── */}
      <aside className="relative hidden overflow-hidden bg-orange-100 lg:block">
        {/* Plain <img> so any admin-provided URL works without next/image config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />

        <div className="absolute inset-x-0 bottom-0 z-10 p-12">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.55)] xl:text-5xl">
            Thanks for helping make lives better
          </h2>
        </div>
      </aside>

      {/* ── Right: form panel (holds the only logo) ──────────────────────── */}
      <main className="flex min-h-screen flex-col bg-white">
        {/* Mobile brand header (photo panel is hidden on small screens) */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 px-6 pb-8 pt-10 text-center lg:hidden">
          <Image
            src="/logo-inline-black.png"
            alt="Lighthouse Care"
            width={200}
            height={52}
            className="mx-auto h-9 w-auto brightness-0 invert"
            priority
          />
          <p className="mt-2 text-sm font-medium tracking-wide text-orange-100">
            Volunteer Portal
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            {/* The single logo — desktop only (mobile shows it in the header above) */}
            <div className="mb-8 hidden lg:block">
              <Link href="/" aria-label="Lighthouse Care — home">
                <Image
                  src="/logo-inline-black.png"
                  alt="Lighthouse Care"
                  width={180}
                  height={48}
                  className="h-8 w-auto"
                />
              </Link>
              <p className="mt-1.5 text-sm text-gray-400">Volunteer Portal</p>
            </div>

            {children}
          </div>
        </div>

        <div className="space-y-1 px-6 pb-6 text-center text-xs text-gray-400">
          <p>
            <a
              href={CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-500 hover:underline"
            >
              Contact us
            </a>
          </p>
          <p>Lighthouse Care &mdash; ABN 87 637 110 948 &mdash; ACNC Registered Charity</p>
        </div>
      </main>
    </div>
  )
}
