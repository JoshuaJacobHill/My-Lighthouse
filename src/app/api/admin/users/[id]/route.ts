import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hashPassword } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ASSIGNABLE_ADMIN_ROLES } from '@/lib/constants'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') return null
  return session
}

// ─── PATCH — edit an admin user ───────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { name, email, role, password, canViewDonations } = body as {
      name?: string
      email?: string
      role?: string
      password?: string
      canViewDonations?: boolean
    }

    const allowedRoles = ASSIGNABLE_ADMIN_ROLES as readonly string[]
    if (role && !allowedRoles.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 })
    }

    if (password && password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    // Check email uniqueness if changing
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), NOT: { id } },
      })
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'That email is already in use.' },
          { status: 400 }
        )
      }
    }

    const data: Record<string, unknown> = {}
    if (name) data.name = name
    if (email) data.email = email.toLowerCase()
    if (role) data.role = role
    if (password) data.passwordHash = await hashPassword(password)
    if (typeof canViewDonations === 'boolean') data.canViewDonations = canViewDonations

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, canViewDonations: true, lastLoginAt: true },
    })

    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error('[PATCH /api/admin/users/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to update user.' }, { status: 500 })
  }
}

// ─── DELETE — remove an admin user ───────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params

  // Prevent self-deletion
  if (session.userId === id) {
    return NextResponse.json(
      { success: false, error: 'You cannot delete your own account.' },
      { status: 400 }
    )
  }

  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/admin/users/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to delete user.' }, { status: 500 })
  }
}
