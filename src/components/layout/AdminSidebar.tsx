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
  Megaphone,
  Newspaper,
  Church,
  Receipt,
  ArrowLeftRight,
  Mail,
  Star,
  Settings,
  Bell,
  Building2,
  Images,
  Camera,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Capability } from '@/lib/permissions-core'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  /** Hidden unless the admin holds at least one of these. Omitted = every admin. */
  needs?: Capability[]
}

interface NavGroup {
  id: string
  label: string
  icon: React.ElementType
  items: NavItem[]
}

type NavEntry = NavItem | NavGroup

const isGroup = (entry: NavEntry): entry is NavGroup => 'items' in entry

/**
 * Grouped by *domain*, not by audience — the same rule the capability
 * namespace follows. A group is shown only when the admin can open at least
 * one page inside it, so a church manager sees four labels where a super admin
 * sees six.
 *
 * Hiding a link is presentation only: every page and action behind one keeps
 * its own server-side capability guard.
 */
const nav: NavEntry[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    items: [
      { href: '/admin/users', label: 'Users', icon: Users, needs: ['care.people', 'church.members', 'care.giving'] },
      { href: '/admin/roster', label: 'Roster / Calendar', icon: Calendar, needs: ['care.people'] },
      { href: '/admin/on-site', label: 'On-Site Now', icon: MapPin, needs: ['care.people'] },
      { href: '/admin/attendance', label: 'Attendance', icon: CheckSquare, needs: ['care.people'] },
      { href: '/admin/feedback', label: 'Volunteer Feedback', icon: Star, needs: ['care.people'] },
      { href: '/admin/reports', label: 'Reports', icon: BarChart2, needs: ['care.people'] },
      { href: '/admin/teams', label: 'Serving Teams', icon: Church, needs: ['church.teams'] },
    ],
  },
  {
    id: 'giving',
    label: 'Giving',
    icon: HeartHandshake,
    items: [
      { href: '/admin/funds', label: 'Funds', icon: HeartHandshake, needs: ['care.giving'] },
      { href: '/admin/fundraisers', label: 'Fundraisers', icon: Megaphone, needs: ['care.giving'] },
      { href: '/admin/events', label: 'Events', icon: Ticket, needs: ['care.giving'] },
      { href: '/admin/partners', label: 'Partners', icon: Building2, needs: ['care.giving'] },
      { href: '/admin/transactions', label: 'Transactions', icon: Receipt, needs: ['care.giving', 'church.giving'] },
      { href: '/admin/migrations', label: 'Donor Migration', icon: ArrowLeftRight, needs: ['care.giving'] },
    ],
  },
  {
    id: 'communications',
    label: 'Communications',
    icon: Newspaper,
    items: [
      { href: '/admin/stories', label: 'Good News', icon: Newspaper, needs: ['care.stories', 'church.stories'] },
      { href: '/admin/emails', label: 'Emails', icon: Mail, needs: ['system.settings'] },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell, needs: ['system.settings'] },
      { href: '/admin/marketing', label: 'Marketing', icon: Megaphone, needs: ['business.reports'] },
      { href: '/admin/media', label: 'Media Library', icon: Images, needs: ['business.reports'] },
    ],
  },
  { href: '/admin/tasks', label: 'Tasks & Checklists', icon: CheckSquare, needs: ['care.tasks'] },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { href: '/admin/settings', label: 'General Settings', icon: Settings, needs: ['system.settings'] },
      { href: '/admin/meta-scopes', label: 'Meta Permissions', icon: ShieldCheck, needs: ['business.reports'] },
      { href: '/admin/ig-backfill', label: 'Instagram Backfill', icon: Camera, needs: ['business.reports'] },
    ],
  },
]

const isVisible = (item: NavItem, capabilities: Capability[]) =>
  !item.needs || item.needs.some((c) => capabilities.includes(c))

/** The nav the signed-in admin can actually use — empty groups drop out. */
function visibleNav(capabilities: Capability[]): NavEntry[] {
  return nav.reduce<NavEntry[]>((acc, entry) => {
    if (!isGroup(entry)) {
      if (isVisible(entry, capabilities)) acc.push(entry)
      return acc
    }
    const items = entry.items.filter((i) => isVisible(i, capabilities))
    if (items.length) acc.push({ ...entry, items })
    return acc
  }, [])
}

/** Flat list of every visible link — used by the icon-only collapsed rail. */
function flatItems(entries: NavEntry[]): NavItem[] {
  return entries.flatMap((e) => (isGroup(e) ? e.items : [e]))
}

interface SidebarLinkProps {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  nested?: boolean
}

function SidebarLink({ item, isActive, collapsed, nested = false }: SidebarLinkProps) {
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
        collapsed && 'justify-center',
        nested && !collapsed && 'py-2'
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
  /** Every capability the signed-in admin holds; anything else is hidden. */
  capabilities?: Capability[]
}

export function AdminSidebar({ collapsed = false, onCollapsedChange, capabilities = [] }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const entries = React.useMemo(() => visibleNav(capabilities), [capabilities])

  const isActive = React.useCallback(
    (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)),
    [pathname]
  )

  // The group holding the current page opens itself; anything the admin opens
  // by hand stays open as they move around.
  const activeGroupId = entries.find((e) => isGroup(e) && e.items.some((i) => isActive(i.href)))
  const activeId = activeGroupId && isGroup(activeGroupId) ? activeGroupId.id : null

  const [openIds, setOpenIds] = React.useState<string[]>(activeId ? [activeId] : [])
  React.useEffect(() => {
    if (activeId) setOpenIds((prev) => (prev.includes(activeId) ? prev : [...prev, activeId]))
  }, [activeId])

  const toggleGroup = (id: string) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const backToPortal = (
    <Link
      href="/dashboard"
      title={collapsed ? 'My dashboard' : undefined}
      className={clsx(
        'flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50',
        collapsed && 'justify-center'
      )}
    >
      <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span>My dashboard</span>}
    </Link>
  )

  /** Collapsed rail stays a flat column of icons — grouping needs the labels. */
  const renderNav = (isCollapsed: boolean) => {
    if (isCollapsed) {
      return flatItems(entries).map((item) => (
        <SidebarLink key={item.href} item={item} isActive={isActive(item.href)} collapsed />
      ))
    }

    return entries.map((entry) => {
      if (!isGroup(entry)) {
        return <SidebarLink key={entry.href} item={entry} isActive={isActive(entry.href)} collapsed={false} />
      }

      const open = openIds.includes(entry.id)
      const hasActiveChild = entry.items.some((i) => isActive(i.href))
      const GroupIcon = entry.icon

      return (
        <div key={entry.id}>
          <button
            type="button"
            onClick={() => toggleGroup(entry.id)}
            aria-expanded={open}
            aria-controls={`admin-nav-${entry.id}`}
            className={clsx(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              hasActiveChild && !open
                ? 'bg-orange-50 text-orange-600'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <GroupIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{entry.label}</span>
            <ChevronDown
              className={clsx('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
          {open && (
            <div id={`admin-nav-${entry.id}`} className="mt-1 space-y-0.5 border-l border-gray-200 pl-3 ml-4">
              {entry.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  collapsed={false}
                  nested
                />
              ))}
            </div>
          )}
        </div>
      )
    })
  }

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
        {renderNav(collapsed)}
        <div className="mt-4 border-t border-gray-200 pt-4">{backToPortal}</div>
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
              {renderNav(false)}
              <div className="mt-4 border-t border-gray-200 pt-4">{backToPortal}</div>
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
