'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { clsx } from 'clsx'
import Image from 'next/image'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/volunteer/apply', label: 'Volunteer' },
  { href: '/signup', label: 'Sign Up' },
  { href: '/login', label: 'Sign In' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header className="bg-gray-900 shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" aria-label="Lighthouse Care — home" className="flex items-center">
            <Image
              src="/logo-inline-black.png"
              alt="Lighthouse Care"
              width={180}
              height={48}
              className="h-9 w-auto brightness-0 invert"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-controls="mobile-menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav
          id="mobile-menu"
          className="md:hidden border-t border-gray-700 bg-gray-900 pb-3 pt-2"
          aria-label="Mobile navigation"
        >
          <div className="space-y-1 px-4">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
