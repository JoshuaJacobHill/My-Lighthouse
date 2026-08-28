import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const allowedRoles = ['KIOSK', 'ADMIN', 'SUPER_ADMIN', 'CARE_MANAGER']
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const volunteerId = searchParams.get('volunteerId')

  if (!volunteerId) {
    return NextResponse.json({ error: 'volunteerId is required' }, { status: 400 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        volunteerId,
        signInAt: { gte: today },
        signOutAt: null,
      },
      orderBy: { signInAt: 'desc' },
    })

    if (!record) {
      return NextResponse.json({ attendanceId: null })
    }

    return NextResponse.json({ attendanceId: record.id })
  } catch (err) {
    console.error('[open-attendance route]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
