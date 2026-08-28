import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

// Mirror of buildInvite's staff branch, for previewing without sending.
async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['nathan@lighthousecare.org.au', 'dan@lighthousecare.org.au'] } },
    select: { name: true, email: true, isStaff: true, passwordHash: true },
  })
  console.log('recipients:')
  for (const u of users) console.log(`  ${u.name} <${u.email}>  staff=${u.isStaff} password=${u.passwordHash ? 'set' : 'none'}`)

  console.log('\n──────── SUBJECT ────────')
  console.log('Your Lighthouse account is ready')
  console.log('\n──────── BODY (plain text) ────────')
  console.log(`Hi Nathan,

Your account on the My Lighthouse Portal is set up. It's where the team keeps track of tasks and checklists, payslips and leave, staff news, and the September step challenge.

Pick a password and you're in:
https://my.lighthousecare.org.au/set-password?token=<unique 7-day link>

The link works for the next 7 days. Any trouble getting in, just reply to this email.`)
}
main().then(() => process.exit(0))
