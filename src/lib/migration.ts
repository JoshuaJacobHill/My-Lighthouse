import crypto from 'crypto'
import prisma from '@/lib/prisma'

/**
 * Donor migration intents (e.g. moving recurring givers across from Shout for
 * Good). Cards can't be transferred, so each donor gets a tokenised
 * "re-confirm your card" link that pre-fills everything but the card. See
 * `MigrationIntent` in the schema and `/give/resume/[token]`.
 */

const MIGRATION_EXPIRY_DAYS = 60

export type MigrationFrequency = 'weekly' | 'fortnightly' | 'monthly'

export function isMigrationFrequency(v: string): v is MigrationFrequency {
  return v === 'weekly' || v === 'fortnightly' || v === 'monthly'
}

export interface CreateMigrationInput {
  email: string
  donorName?: string | null
  donorCompany?: string | null
  amountCents: number
  frequency: MigrationFrequency
  fundSlug: string
  source?: string
}

/** Create (or refresh) a pending migration intent for a donor. */
export async function createMigrationIntent(input: CreateMigrationInput) {
  const email = input.email.trim().toLowerCase()
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + MIGRATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  return prisma.migrationIntent.create({
    data: {
      token,
      email,
      donorName: input.donorName?.trim() || null,
      donorCompany: input.donorCompany?.trim() || null,
      amountCents: input.amountCents,
      frequency: input.frequency,
      fundSlug: input.fundSlug,
      source: input.source ?? 'shout_for_good',
      status: 'PENDING',
      expiresAt,
    },
  })
}

/** Look up a live (pending, unexpired) intent by token — for the resume page. */
export async function getLiveMigrationIntent(token: string) {
  const intent = await prisma.migrationIntent.findUnique({ where: { token } })
  if (!intent) return null
  if (intent.status !== 'PENDING') return { intent, state: 'not_pending' as const }
  if (intent.expiresAt < new Date()) return { intent, state: 'expired' as const }
  return { intent, state: 'live' as const }
}

/** Mark an intent completed once its subscription is created (idempotent). */
export async function completeMigrationIntent(id: string, subscriptionId: string | null) {
  await prisma.migrationIntent.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'COMPLETED', completedAt: new Date(), subscriptionId },
  })
}
