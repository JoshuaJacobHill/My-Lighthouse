'use server'

import { z } from 'zod'
import prisma from '@/lib/prisma'
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth'
import { validateAccountSetupToken, consumeAccountSetupToken } from '@/lib/account-setup'
import { claimDonationsForUser } from '@/lib/donations'

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

    return { success: true, redirectTo: '/donor' }
  } catch (err) {
    console.error('completeDonorAccountAction failed', err)
    return { success: false, error: 'Could not complete your account. Please try again.' }
  }
}
