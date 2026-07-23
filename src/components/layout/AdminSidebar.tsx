'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Calendar,
  MapPin,
  CheckSquare,
  BarChart2,
  HeartHandshake,
  Ticket,
  Mail,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/volunteers', label: 'Volunteers', icon: Users },
  { href: '/admin/roster', label: 'Roster / Calendar', icon: Calendar },
  { href: '/admin/on-site', label: 'On-Site Now', icon: MapPin },
  { href: '/admin/attendance', label: 'Attendance', icon: CheckSquare },
  { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
  { href: '/admin/funds', label: 'Funds', icon: HeartHandshake },
  { href: '/admin/events', label: 'Events', icon: Ticket },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

interface SidebarLinkProps {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}

function SidebarLink({ item, isActive, collapsed }: SidebarLinkProps) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-orange-500 text-white shadow-sm'
          : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600',
        collapsed && 'justify-center'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

interface AdminSidebarProps {
  /** Controlled collapsed state — for desktop only */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

export function AdminSidebar({ collapsed = false, onCollapsedChange }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className={clsx('flex items-center border-b border-gray-200 px-4 py-4', collapsed ? 'justify-center' : 'gap-2')}>
        {!collapsed && (
          <Link href="/admin" className="flex flex-col gap-0.5">
            <Image
              src="/logo-inline-black.png"
              alt="Lighthouse Care"
              width={150}
              height={40}
              className="h-7 w-auto"
            />
            <span className="text-xs text-gray-500 pl-0.5">Admin</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/admin">
            <Image
              src="/logo-square.png"
              alt="Lighthouse Care"
              width={32}
              height={32}
              className="h-8 w-8 rounded"
            />
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Admin navigation">
        {navItems.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Collapse toggle (desktop) */}
      <div className="border-t border-gray-200 p-3">
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col border-r border-gray-200 bg-white transition-all duration-200',
          collapsed ? 'w-16' : 'w-64'
        )}
        aria-label="Admin sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Mobile: hamburger trigger */}
      <div className="lg:hidden fixed top-0 left-0 z-30 p-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md bg-orange-500 p-2 text-white shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile: overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel */}
          <aside className="relative z-50 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
              <div className="flex flex-col gap-0.5">
                <Image
                  src="/logo-inline-black.png"
                  alt="Lighthouse Care"
                  width={150}
                  height={40}
                  className="h-7 w-auto"
                />
                <span className="text-xs text-gray-500 pl-0.5">Admin</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Admin navigation">
              {navItems.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  collapsed={false}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
