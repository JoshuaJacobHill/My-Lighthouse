import crypto from 'crypto'
import prisma from '@/lib/prisma'

/**
 * Email-scoped account-setup tokens for the "donate now, make an account later"
 * flow (donor portal — plan §8). Unlike PasswordResetToken these aren't tied to
 * a userId, because the account doesn't exist yet — the token is keyed to the
 * verified email (reusing the VerificationToken table).
 */

const SETUP_EXPIRY_DAYS = 14

export async function createAccountSetupToken(email: string): Promise<string> {
  const identifier = email.trim().toLowerCase()
  // One live setup link per email — replace any previous.
  await prisma.verificationToken.deleteMany({ where: { identifier } })
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SETUP_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  await prisma.verificationToken.create({ data: { identifier, token, expires } })
  return token
}

export async function validateAccountSetupToken(
  token: string
): Promise<{ email: string } | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record) return null
  if (record.expires < new Date()) return null
  return { email: record.identifier }
}

export async function consumeAccountSetupToken(token: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { token } })
}
