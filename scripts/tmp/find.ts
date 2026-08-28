import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
async function main() {
  const recent = await prisma.user.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } },
    select: { id: true, name: true, email: true, passwordHash: true, isStaff: true, isTrainee: true, createdAt: true, emailVerified: true },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })
  for (const u of recent) {
    console.log(`${(u.name ?? '—').padEnd(22)} ${u.email.padEnd(36)} password=${u.passwordHash ? 'yes' : 'NO '} staff=${u.isStaff} created=${u.createdAt.toISOString().slice(0,16)}`)
  }
  console.log('\nemails sent to them:')
  for (const u of recent) {
    const n = await prisma.emailLog.count({ where: { to: { equals: u.email, mode: "insensitive" } } })
    if (n === 0) console.log(`  NONE ever sent to ${u.email}`)
    else console.log(`  ${n} to ${u.email}`)
  }
}
main().then(() => process.exit(0))
