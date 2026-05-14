import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, validatePasswordResetToken, consumePasswordResetToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let token: string
  let password: string
  try {
    const body = await req.json()
    token = (body.token ?? '').trim()
    password = body.password ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const valid = await validatePasswordResetToken(token)
  if (!valid) {
    return NextResponse.json(
      { error: 'This link is invalid or has expired. Please request a new one.' },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)

  await prisma.user.update({
    where: { id: valid.userId },
    data: { passwordHash },
  })

  await consumePasswordResetToken(token)

  return NextResponse.json({ success: true })
}
