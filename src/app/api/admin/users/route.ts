import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hashPassword } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') return null
  return session
}

export async function POST(request: NextRequest) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, email, password, role } = body as {
      name: string
      email: string
      password: string
      role: string
    }

    if (!name || !email || !password || !role) {
      return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 })
    }

    const allowedRoles = ['ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'An account with that email already exists.' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: role as 'ADMIN' | 'SUPER_ADMIN',
        isActive: true,
        emailVerified: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })

    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error('[POST /api/admin/users]', err)
    return NextResponse.json({ success: false, error: 'Failed to create user.' }, { status: 500 })
  }
}
