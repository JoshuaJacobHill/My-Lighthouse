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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const { id: shiftId } = await params

  try {
    const body = await request.json()
    const { volunteerId } = body

    if (!volunteerId) {
      return NextResponse.json({ success: false, error: 'volunteerId is required' }, { status: 400 })
    }

    // Load the shift to check capacity
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId, isActive: true },
      include: {
        assignments: {
          where: {
            status: { notIn: ['ADMIN_CANCELLED', 'CANCELLED_BY_VOLUNTEER'] },
          },
        },
      },
    })

    if (!shift) {
      return NextResponse.json({ success: false, error: 'Shift not found.' }, { status: 404 })
    }

    if (shift.assignments.length >= shift.capacity) {
      return NextResponse.json({ success: false, error: 'This shift is already at full capacity.' }, { status: 409 })
    }

    // Upsert — if the volunteer already has an assignment (perhaps cancelled), update it
    const assignment = await prisma.shiftAssignment.upsert({
      where: { shiftId_volunteerId: { shiftId, volunteerId } },
      create: {
        shiftId,
        volunteerId,
        status: 'SCHEDULED',
        createdById: session.userId,
      },
      update: {
        status: 'SCHEDULED',
        cancelledAt: null,
        cancelReason: null,
      },
    })

    return NextResponse.json({ success: true, assignment })
  } catch (err) {
    console.error('[POST /api/admin/shifts/[id]/assign]', err)
    return NextResponse.json({ success: false, error: 'Failed to assign volunteer.' }, { status: 500 })
  }
}
