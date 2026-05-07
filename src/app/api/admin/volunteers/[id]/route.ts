import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// ─── DELETE /api/admin/volunteers/[id] ───────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  // Find the volunteer profile to get the linked userId
  const profile = await prisma.volunteerProfile.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 })
  }

  // Deleting the User cascades to VolunteerProfile and all related records
  // (availability, shifts, attendance, notes, emails, induction, quiz answers, sessions)
  await prisma.user.delete({ where: { id: profile.userId } })

  return NextResponse.json({ success: true })
}
