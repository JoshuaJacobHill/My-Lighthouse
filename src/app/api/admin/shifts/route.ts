import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasCapability } from '@/lib/permissions'

async function requireAdmin() {
  const session = await getSession()
  if (!session || !(await hasCapability('care.people'))) {
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
    const { date, startTime, endTime, locationId, departmentId, title, capacity, notes } = body

    if (!date || !startTime || !endTime || !locationId) {
      return NextResponse.json(
        { success: false, error: 'date, startTime, endTime, and locationId are required.' },
        { status: 400 }
      )
    }

    const shift = await prisma.shift.create({
      data: {
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        locationId,
        departmentId: departmentId || null,
        title: title || null,
        capacity: capacity ?? 1,
        notes: notes || null,
        createdById: session.userId,
      },
    })

    return NextResponse.json({ success: true, shift })
  } catch (err) {
    console.error('[POST /api/admin/shifts]', err)
    return NextResponse.json({ success: false, error: 'Failed to create shift.' }, { status: 500 })
  }
}
