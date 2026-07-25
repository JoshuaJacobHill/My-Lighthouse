import * as React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { SettingsTabs } from './SettingsTabs'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Settings | Lighthouse Care Admin' }

async function getSettings(): Promise<Record<string, string>> {
  const settings = await prisma.appSetting.findMany()
  return Object.fromEntries(settings.map((s) => [s.key, s.value]))
}

export default async function SettingsPage() {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login')
  }

  const [settings, admins] = await Promise.all([
    getSettings(),
    session.role === 'SUPER_ADMIN'
      ? prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            canViewDonations: true,
            lastLoginAt: true,
          },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure your organisation&apos;s volunteer management system.
        </p>
      </div>

      <SettingsTabs
        settings={settings}
        admins={admins}
        isSuperAdmin={session.role === 'SUPER_ADMIN'}
      />
    </div>
  )
}
