'use client'

import * as React from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'
import { Avatar } from '@/components/ui/avatar'
import type { Capability } from '@/lib/permissions-core'

interface AdminUser {
  id: string
  name?: string | null
  email?: string | null
}

interface AdminLayoutProps {
  user: AdminUser
  capabilities?: Capability[]
  children: React.ReactNode
}

export default function AdminLayout({ user, capabilities = [], children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const router = useRouter()

  const userName = user.name ?? 'Admin User'
  const userEmail = user.email ?? ''

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        capabilities={capabilities}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6 shadow-sm">
          <div className="lg:pl-0 pl-12">
            <span className="text-sm font-semibold text-gray-700">Admin Panel</span>
          </div>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-none">
              <span className="text-sm font-medium text-gray-900">{userName}</span>
              {userEmail && (
                <span className="text-xs text-gray-500">{userEmail}</span>
              )}
            </div>
            <Avatar name={userName} size="sm" />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
