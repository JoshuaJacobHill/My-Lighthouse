import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasCapability } from '@/lib/permissions'

async function requireAdmin() {
  const session = await getSession()
  if (!session || !(await hasCapability('system.settings'))) {
    return null
  }
  return session
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { settings } = body as { settings: Record<string, string> }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid payload.' }, { status: 400 })
    }

    // Upsert each key/value pair
    await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/admin/settings]', err)
    return NextResponse.json({ success: false, error: 'Failed to save settings.' }, { status: 500 })
  }
}
