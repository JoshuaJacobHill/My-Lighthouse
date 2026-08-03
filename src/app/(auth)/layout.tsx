import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Sign In',
}

// Swap this for a brand lifestyle photo any time (drop it in /public and update
// the src). Kept as a real Good Food image so the panel looks intentional.
const HERO_IMAGE = '/fundraisers/good-food-box.png'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left: brand / photo panel (desktop only) ─────────────────────── */}
      <aside className="relative hidden lg:block">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 0px"
          className="object-cover"
        />
        {/* Warm brand wash so the white type is always legible */}
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-900/95 via-orange-700/70 to-orange-500/30" />

        <div className="absolute inset-0 z-10 flex flex-col justify-between p-12">
          <Link href="/" aria-label="Lighthouse Care — home">
            <Image
              src="/logo-inline-black.png"
              alt="Lighthouse Care"
              width={220}
              height={56}
              className="h-9 w-auto brightness-0 invert drop-shadow"
              priority
            />
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl font-extrabold leading-tight text-white drop-shadow-sm xl:text-5xl">
              Thanks for helping make lives better
            </h2>
            <p className="mt-4 text-sm font-medium tracking-wide text-orange-50/90">
              Lighthouse Care &mdash; ABN 87 637 110 948 &mdash; ACNC Registered Charity
            </p>
          </div>
        </div>
      </aside>

      {/* ── Right: form panel ────────────────────────────────────────────── */}
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
            {/* Small wordmark on desktop, where there's no mobile header */}
            <div className="mb-8 hidden lg:block">
              <Image
                src="/logo-inline-black.png"
                alt="Lighthouse Care"
                width={180}
                height={48}
                className="h-8 w-auto"
              />
              <p className="mt-1.5 text-sm text-gray-400">Volunteer Portal</p>
            </div>

            {children}
          </div>
        </div>

        <p className="px-6 pb-6 text-center text-xs text-gray-400">
          Lighthouse Care &mdash; ABN 87 637 110 948 &mdash; ACNC Registered Charity
        </p>
      </main>
    </div>
  )
}
