import crypto from 'crypto'
import bcryptjs from 'bcryptjs'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

const SESSION_COOKIE_NAME = 'SESSION_TOKEN'
const SESSION_DURATION_DAYS = 30

// ─── Password hashing ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash)
}

// ─── Session management ───────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  await prisma.userSession.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  return token
}

export async function getSession(): Promise<{
  userId: string
  role: string
  volunteerId?: string
} | null> {
  try {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get(SESSION_COOKIE_NAME)

    if (!tokenCookie?.value) {
      return null
    }

    const token = tokenCookie.value

    const session = await prisma.userSession.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            volunteerProfile: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (!session) {
      return null
    }

    if (session.expiresAt < new Date()) {
      await prisma.userSession.delete({ where: { id: session.id } })
      return null
    }

    if (!session.user.isActive) {
      return null
    }

    return {
      userId: session.userId,
      role: session.user.role,
      volunteerId: session.user.volunteerProfile?.id ?? undefined,
    }
  } catch {
    return null
  }
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get(SESSION_COOKIE_NAME)

    if (tokenCookie?.value) {
      await prisma.userSession.deleteMany({
        where: { token: tokenCookie.value },
      })
    }
  } catch {
    // Silently fail — session may already be gone
  }
}

// ─── Cookie management ────────────────────────────────────────────────────────

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

// ─── Password reset tokens ────────────────────────────────────────────────────

export async function createPasswordResetToken(userId: string, expiresInHours = 48): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
  // Delete any existing unused tokens for this user first
  await prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  })
  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt },
  })
  return token
}

export async function validatePasswordResetToken(token: string): Promise<{ userId: string } | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!record) return null
  if (record.usedAt) return null
  if (record.expiresAt < new Date()) return null
  return { userId: record.userId }
}

export async function consumePasswordResetToken(token: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { token },
    data: { usedAt: new Date() },
  })
}
