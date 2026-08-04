'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Heart,
  Receipt,
  Calendar,
  Clock,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Avatar } from '@/components/ui/avatar'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
}

export interface PortalCapabilities {
  isVolunteer: boolean
  hasGiven: boolean
  // Future: isPartner (corporate) adds its own items + dashboard section.
}

/**
 * Shared portal shell — one left-sidebar layout for everyone (donors,
 * volunteers, both). The menu is composed from the person's capabilities, so a
 * third capability (corporate partnership) later just contributes more items.
 */
export function PortalShell({
  children,
  userName,
  isVolunteer,
  hasGiven,
}: {
  children: React.ReactNode
  userName: string
} & PortalCapabilities) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const displayName = userName || 'Friend'

  const items: NavItem[] = [
    { href: '/donor', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/donate', label: 'Give', icon: Heart },
    ...(hasGiven ? [{ href: '/donor/giving', label: 'My giving', icon: Receipt }] : []),
    ...(isVolunteer
      ? [
          { href: '/volunteer/shifts', label: 'My shifts', icon: Calendar },
          { href: '/volunteer/availability', label: 'My availability', icon: Clock },
        ]
      : []),
    isVolunteer
      ? { href: '/volunteer/profile', label: 'My profile', icon: User }
      : { href: '/donor/account', label: 'My account', icon: User },
  ]

  const roleLabel =
    isVolunteer && hasGiven
      ? 'Volunteer & supporter'
      : isVolunteer
        ? 'Volunteer'
        : hasGiven
          ? 'Supporter'
          : 'Member'

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const navContent = (
    <nav aria-label="Portal navigation">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
              <p className="text-xs text-gray-500">{roleLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">{navContent}</div>

        <div className="border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size="sm" />
            <span className="text-sm font-semibold text-gray-900">{displayName}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <div className="space-y-1 border-b border-gray-200 bg-white px-4 py-3 shadow-sm lg:hidden">
            {navContent}
            <div className="mt-2 border-t border-gray-100 pt-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
