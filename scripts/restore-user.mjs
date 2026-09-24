/**
 * Restore a user account that was deleted by mistake.
 *
 * Dry run by default. Prints what it would do and changes nothing; pass
 * --apply to write.
 *
 *   node scripts/restore-user.mjs dan@lighthousecare.org.au ADMIN "Dan"
 *   node scripts/restore-user.mjs dan@lighthousecare.org.au ADMIN "Dan" --apply
 *
 * This recreates the ACCOUNT. It cannot bring back what cascaded off the
 * deleted row — the donor profile, linked sign-ins, sessions, push
 * subscriptions, extra email addresses. If any of that matters, stop and use
 * Supabase point-in-time recovery instead; that window does not stay open.
 *
 * Deliberately creates the account with NO password. A password set by
 * somebody else is not proof the owner is back in control — they set their own
 * through the reset link, which is the same rule account-check.ts enforces
 * everywhere else.
 */
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'

const [emailArg, roleArg = 'ADMIN', nameArg = null] = process.argv.slice(2).filter((a) => a !== '--apply')
const APPLY = process.argv.includes('--apply')

if (!emailArg) {
  console.error('Usage: node scripts/restore-user.mjs <email> [ROLE] [Name] [--apply]')
  process.exit(1)
}

const email = emailArg.trim().toLowerCase()
const ROLES = ['VOLUNTEER', 'ADMIN', 'SUPER_ADMIN', 'KIOSK', 'CARE_MANAGER', 'CHURCH_MANAGER']
if (!ROLES.includes(roleArg)) {
  console.error(`Role must be one of: ${ROLES.join(', ')}`)
  process.exit(1)
}

// The session pooler, the same URL push-schema.sh uses. Never DATABASE_URL —
// .env.local points at a local database and this would silently do nothing.
const url = fs.readFileSync(new URL('./migrate/.sydney', import.meta.url), 'utf8').trim()
const prisma = new PrismaClient({ datasources: { db: { url } } })

try {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
  })

  if (existing) {
    console.log('That account already exists:')
    console.log({ ...existing, passwordHash: existing.passwordHash ? '(set)' : null })
    if (existing.role === roleArg && existing.isActive) {
      console.log(`\nNothing to do — already ${roleArg} and active.`)
      process.exit(0)
    }
    console.log(`\nWould set role to ${roleArg} and isActive true.`)
    if (!APPLY) {
      console.log('Dry run. Re-run with --apply to make the change.')
      process.exit(0)
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: roleArg, isActive: true },
      select: { id: true, email: true, role: true, isActive: true },
    })
    console.log('\nUpdated:', updated)
    process.exit(0)
  }

  console.log(`No account for ${email}. Would create:`)
  console.log({ email, name: nameArg, role: roleArg, isActive: true, passwordHash: null })
  console.log('\nThey will need to set a password themselves via "Forgot your password".')

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create it.')
    process.exit(0)
  }

  const created = await prisma.user.create({
    data: { email, name: nameArg, role: roleArg, isActive: true },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })
  console.log('\nCreated:', created)
  console.log('Ask them to use "Forgot your password" on the sign-in page.')
} catch (err) {
  console.error('Failed:', err.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
