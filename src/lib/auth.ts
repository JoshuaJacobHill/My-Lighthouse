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

// ─── Signed-cookie sessions ───────────────────────────────────────────────────
//
// Session data is embedded directly in the cookie as a HMAC-signed payload.
// This means getSession() never needs a DB query — it just verifies the
// signature and reads the payload. Much faster for every page load.
//
// Format:  <base64url(JSON payload)>.<base64url(HMAC-SHA256 signature)>

interface SessionPayload {
  userId: string
  role: string
  volunteerId?: string
  exp: number // Unix timestamp (seconds)
}

function getHmacKey(): string {
  const key = process.env.SESSION_SECRET
  if (!key) {
    // In development fall back to a constant so sessions survive restarts.
    // In production SESSION_SECRET must be set in Vercel env vars.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET env var is not set')
    }
    return 'dev-lighthouse-secret-do-not-use-in-production'
  }
  return key
}

function signPayload(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', getHmacKey())
    .update(encoded)
    .digest('base64url')
  return `${encoded}.${sig}`
}

function verifyToken(token: string): SessionPayload | null {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return null
    const encoded = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)

    const expected = crypto
      .createHmac('sha256', getHmacKey())
      .update(encoded)
      .digest('base64url')

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null // expired

    return payload
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<void> {
  // Fetch the user's role and volunteerId once at login time — they're then
  // embedded in the signed cookie for the session lifetime.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      volunteerProfile: { select: { id: true } },
    },
  })

  if (!user || !user.isActive) return

  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 86400

  const payload: SessionPayload = {
    userId,
    role: user.role,
    volunteerId: user.volunteerProfile?.id ?? undefined,
    exp,
  }

  const token = signPayload(payload)
  await setSessionCookie(token)
}

export async function getSession(): Promise<{
  userId: string
  role: string
  volunteerId?: string
} | null> {
  try {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get(SESSION_COOKIE_NAME)
    if (!tokenCookie?.value) return null

    const payload = verifyToken(tokenCookie.value)
    if (!payload) return null

    return {
      userId: payload.userId,
      role: payload.role,
      volunteerId: payload.volunteerId,
    }
  } catch {
    return null
  }
}

export async function destroySession(): Promise<void> {
  try {
    await clearSessionCookie()
  } catch {
    // Silently fail
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
