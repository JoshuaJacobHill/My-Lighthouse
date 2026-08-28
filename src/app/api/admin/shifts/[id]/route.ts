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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.shift.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/admin/shifts/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to delete shift.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const shift = await prisma.shift.update({
      where: { id },
      data: {
        ...(body.date && { date: new Date(body.date) }),
        ...(body.startTime && { startTime: new Date(body.startTime) }),
        ...(body.endTime && { endTime: new Date(body.endTime) }),
        ...(body.locationId && { locationId: body.locationId }),
        ...(body.departmentId !== undefined && { departmentId: body.departmentId || null }),
        ...(body.title !== undefined && { title: body.title || null }),
        ...(body.capacity !== undefined && { capacity: body.capacity }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
      },
    })
    return NextResponse.json({ success: true, shift })
  } catch (err) {
    console.error('[PATCH /api/admin/shifts/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to update shift.' }, { status: 500 })
  }
}
