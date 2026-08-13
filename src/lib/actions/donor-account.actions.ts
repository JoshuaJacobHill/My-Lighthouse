'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, createSession, setSessionCookie, getSession } from '@/lib/auth'
import { validateAccountSetupToken, consumeAccountSetupToken } from '@/lib/account-setup'
import { claimDonationsForUser } from '@/lib/donations'
import { rateLimit } from '@/lib/rate-limit'

interface Result {
  success: boolean
  error?: string
  redirectTo?: string
}

const schema = z.object({
  token: z.string().min(1),
  name: z.string().trim().max(120).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type CompleteAccountInput = z.input<typeof schema>

/**
 * Finish a donor's account from a setup link: set their password, mark the
 * email verified (the token proves they received mail at that address), link
 * their past giving, and sign them in. Donating never required an account —
 * this is the optional follow-up (plan §8).
 */
export async function completeDonorAccountAction(input: CompleteAccountInput): Promise<Result> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { token, name, password } = parsed.data

  // Throttle token-guessing / setup abuse per IP.
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`setup:ip:${ip}`, 15, 600_000).ok) {
    return { success: false, error: 'Too many attempts. Please wait a moment and try again.' }
  }

  const valid = await validateAccountSetupToken(token)
  if (!valid) {
    return { success: false, error: 'This link is invalid or has expired. Please request a new one.' }
  }
  const email = valid.email

  try {
    const now = new Date()
    const passwordHash = await hashPassword(password)

    // Create the account, or complete one that somehow already exists for this email.
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        emailVerified: now,
        isActive: true,
        ...(name ? { name } : {}),
      },
      create: {
        email,
        name: name ?? null,
        passwordHash,
        emailVerified: now,
        isActive: true,
      },
      select: { id: true },
    })

    // A donor profile (optional, one per donor).
    await prisma.donorProfile.upsert({
      where: { userId: user.id },
      update: name ? { displayName: name } : {},
      create: { userId: user.id, displayName: name ?? null },
    })

    // Attach any gifts made with this (now verified) email.
    await claimDonationsForUser(user.id, email, now)

    await consumeAccountSetupToken(token)

    const session = await createSession(user.id)
    await setSessionCookie(session)

    return { success: true, redirectTo: '/dashboard' }
  } catch (err) {
    console.error('completeDonorAccountAction failed', err)
    return { success: false, error: 'Could not complete your account. Please try again.' }
  }
}

// ─── Edit account details (signed-in donor) ──────────────────────────────────

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  consentEmailUpdates: z.boolean().optional().default(false),
})
export type UpdateDonorAccountInput = z.input<typeof updateSchema>

export async function updateDonorAccountAction(input: UpdateDonorAccountInput): Promise<Result> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Please sign in again.' }

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Please check your details.' }
  }
  const { name, company, phone, address, consentEmailUpdates } = parsed.data

  try {
    await prisma.user.update({ where: { id: session.userId }, data: { name, company: company?.trim() || null } })
    revalidatePath('/volunteer')
    await prisma.donorProfile.upsert({
      where: { userId: session.userId },
      update: {
        phone: phone || null,
        address: address || null,
        consentEmailUpdates: Boolean(consentEmailUpdates),
      },
      create: {
        userId: session.userId,
        displayName: name,
        phone: phone || null,
        address: address || null,
        consentEmailUpdates: Boolean(consentEmailUpdates),
      },
    })
    revalidatePath('/dashboard/account')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error('updateDonorAccountAction failed', err)
    return { success: false, error: 'Could not save your details. Please try again.' }
  }
}
