'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireDonationsAccess } from '@/lib/permissions'
import { createMigrationIntent, type MigrationFrequency } from '@/lib/migration'
import { parseMigrationCsv } from '@/lib/migration-csv'
import { sendDonorMigrationEmail } from '@/lib/donation-emails'

export async function importMigrationIntentsAction(input: { csv: string; fundSlug: string }) {
  await requireDonationsAccess()

  const fund = await prisma.fund.findUnique({
    where: { slug: input.fundSlug },
    select: { slug: true, isActive: true },
  })
  if (!fund || !fund.isActive) return { success: false, error: 'Please choose a valid, active fund.' }

  const rows = parseMigrationCsv(input.csv)
  const valid = rows.filter((r) => r.ok)
  if (valid.length === 0) {
    return { success: false, error: 'No valid rows found. Check the columns: name, email, company, amount, frequency.' }
  }

  let created = 0
  let skipped = 0
  for (const r of valid) {
    // Don't create a second pending intent for the same donor.
    const existing = await prisma.migrationIntent.findFirst({
      where: { email: r.email, status: 'PENDING' },
      select: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }
    await createMigrationIntent({
      email: r.email,
      donorName: r.name,
      donorCompany: r.company,
      amountCents: r.amountCents,
      frequency: r.frequency as MigrationFrequency,
      fundSlug: fund.slug,
    })
    created++
  }

  revalidatePath('/admin/migrations')
  const invalid = rows.length - valid.length
  return { success: true, created, skipped, invalid }
}

async function sendOne(id: string): Promise<boolean> {
  const intent = await prisma.migrationIntent.findUnique({ where: { id } })
  if (!intent || intent.status !== 'PENDING') return false
  const fund = await prisma.fund.findUnique({ where: { slug: intent.fundSlug }, select: { name: true } })
  await sendDonorMigrationEmail({
    to: intent.email,
    name: intent.donorName,
    amountCents: intent.amountCents,
    frequency: intent.frequency,
    fundName: fund?.name ?? null,
    token: intent.token,
  })
  await prisma.migrationIntent.update({ where: { id }, data: { emailSentAt: new Date() } })
  return true
}

export async function sendMigrationEmailAction(id: string) {
  await requireDonationsAccess()
  try {
    const sent = await sendOne(id)
    if (!sent) return { success: false, error: 'That donor is no longer pending.' }
    revalidatePath('/admin/migrations')
    return { success: true }
  } catch (err) {
    console.error('sendMigrationEmailAction failed', err)
    return { success: false, error: 'Could not send the email. Please try again.' }
  }
}

export async function sendAllPendingMigrationEmailsAction() {
  await requireDonationsAccess()
  const pending = await prisma.migrationIntent.findMany({
    where: { status: 'PENDING' },
    select: { id: true },
  })
  let sent = 0
  let failed = 0
  for (const p of pending) {
    try {
      if (await sendOne(p.id)) sent++
    } catch (err) {
      console.error('bulk migration send failed for', p.id, err)
      failed++
    }
  }
  revalidatePath('/admin/migrations')
  return { success: true, sent, failed }
}

export async function cancelMigrationIntentAction(id: string) {
  await requireDonationsAccess()
  await prisma.migrationIntent.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })
  revalidatePath('/admin/migrations')
  return { success: true }
}
