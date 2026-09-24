// Restore a user account that was deleted by mistake.
//
//   node scripts/restore-user.mjs dan@lighthousecare.org.au ADMIN "Dan"
//   node scripts/restore-user.mjs dan@lighthousecare.org.au ADMIN "Dan" --apply
//
// Dry run by default: prints what it would do and changes nothing.
//
// This recreates the ACCOUNT. It cannot bring back what cascaded off the
// deleted row — the donor profile, linked sign-ins, sessions, push
// subscriptions, extra email addresses. If any of that matters, stop and use
// Supabase point-in-time recovery instead; that window does not stay open.
//
// The account is created with NO password on purpose. A password set by
// somebody else is not proof the owner is back in control — they set their own
// through the reset link, which is the rule account-check.ts enforces
// everywhere else.
//
// Talks to Postgres directly with `pg`, the pattern in docs/DATA.md. NOT
// Prisma: this project is on Prisma 7, whose client needs an adapter, and the
// old `datasources` option is gone. Reads the production URL from
// scripts/migrate/.sydney — `.env.local` points at a local database and this
// would silently do nothing.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const positional = args.filter((a) => !a.startsWith('--'))

const [emailArg, roleArg = 'ADMIN', nameArg = null] = positional
const ROLES = ['VOLUNTEER', 'ADMIN', 'SUPER_ADMIN', 'KIOSK', 'CARE_MANAGER', 'CHURCH_MANAGER']

if (!emailArg) {
  console.error('Usage: node scripts/restore-user.mjs <email> [ROLE] [Name] [--apply]')
  process.exit(1)
}
if (!ROLES.includes(roleArg)) {
  console.error(`Role must be one of: ${ROLES.join(', ')}`)
  process.exit(1)
}

const email = emailArg.trim().toLowerCase()
const url = fs.readFileSync(path.join(here, 'migrate/.sydney'), 'utf8').trim()
const client = new pg.Client({ connectionString: url })

// Prisma generates ids in the client, not the database, so a raw insert has to
// supply one. Same for updatedAt, which is @updatedAt rather than a DB default.
const newId = () => `c${crypto.randomBytes(12).toString('hex')}`

try {
  await client.connect()

  const found = await client.query(
    'select id, email, name, role, "isActive", "passwordHash" is not null as "hasPassword" from "User" where lower(email) = $1',
    [email],
  )

  if (found.rows.length > 0) {
    const user = found.rows[0]
    console.log('That account already exists:')
    console.table([user])

    if (user.role === roleArg && user.isActive) {
      console.log(`\nNothing to do — already ${roleArg} and active.`)
    } else if (!apply) {
      console.log(`\nWould set role to ${roleArg} and isActive true.`)
      console.log('Dry run. Re-run with --apply to make the change.')
    } else {
      const updated = await client.query(
        'update "User" set role = $2::"UserRole", "isActive" = true, "updatedAt" = now() where id = $1 returning id, email, name, role, "isActive"',
        [user.id, roleArg],
      )
      console.log('\nUpdated:')
      console.table(updated.rows)
    }
  } else {
    console.log(`No account for ${email}. Would create:`)
    console.table([{ email, name: nameArg, role: roleArg, isActive: true, password: 'none' }])
    console.log('\nThey set their own password via "Forgot your password" on the sign-in page.')

    if (!apply) {
      console.log('\nDry run. Re-run with --apply to create it.')
    } else {
      const created = await client.query(
        `insert into "User" (id, email, name, role, "isActive", "createdAt", "updatedAt")
         values ($1, $2, $3, $4::"UserRole", true, now(), now())
         returning id, email, name, role, "isActive"`,
        [newId(), email, nameArg, roleArg],
      )
      console.log('\nCreated:')
      console.table(created.rows)
      console.log('Ask them to use "Forgot your password" on the sign-in page.')
    }
  }
} catch (err) {
  console.error('Failed:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
