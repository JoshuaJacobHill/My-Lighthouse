import * as React from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'

const footerLinks = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/volunteer/register', label: 'Become a Volunteer' },
  { href: '/login', label: 'Volunteer Sign In' },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Lighthouse Care</h2>
            <p className="text-sm leading-relaxed text-gray-400">
              Making lives better so that together we can make the world better.
              A not-for-profit charity serving South East Queensland since 2004.
            </p>
            <p className="text-xs text-gray-500">
              ABN 87 637 110 948 &middot; ACNC Registered Charity
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Contact
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-orange-400" aria-hidden="true" />
                <span>Logan, South East Queensland</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-orange-400" aria-hidden="true" />
                <span>
                  Stores at Loganholme &amp; Hillcrest
                </span>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              My Lighthouse Portal
            </h3>
            <ul className="space-y-2 text-sm">
              {footerLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="hover:text-orange-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          <p>
            &copy; {currentYear} Lighthouse Care. All rights reserved.{' '}
            Every dollar spent in our stores directly funds free food relief for families in need.
          </p>
        </div>
      </div>
    </footer>
  )
}
