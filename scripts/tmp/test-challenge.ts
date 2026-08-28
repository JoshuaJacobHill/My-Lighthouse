import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

// Brisbane is UTC+10 year round.
const BNE = 10 * 60 * 60 * 1000
function bneDayBounds(offsetDays = 0) {
  const shifted = new Date(Date.now() + BNE)
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth(), d = shifted.getUTCDate() + offsetDays
  return {
    startsAt: new Date(Date.UTC(y, m, d, 0, 0, 0) - BNE),
    endsAt: new Date(Date.UTC(y, m, d, 23, 59, 59) - BNE),
  }
}

async function main() {
  const { startsAt, endsAt } = bneDayBounds(0)
  const existing = await prisma.fitnessChallenge.findUnique({ where: { slug: 'test-run' } })
  const data = {
    name: 'Step logging test',
    slug: 'test-run',
    unit: 'steps',
    // Small enough that a handful of staff will actually hit it today, so the
    // milestone colours and the goal celebration get exercised.
    goal: 25_000,
    startsAt,
    endsAt,
    isActive: true,
    imageUrl: null, // the September artwork says "STARTS SEP 1ST" — wrong for today
  }
  const c = existing
    ? await prisma.fitnessChallenge.update({ where: { slug: 'test-run' }, data })
    : await prisma.fitnessChallenge.create({ data })

  console.log('test challenge:', JSON.stringify({ name: c.name, goal: c.goal, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString() }))

  const all = await prisma.fitnessChallenge.findMany({ select: { name: true, slug: true, isActive: true, startsAt: true, endsAt: true } })
  console.log('\nall challenges:')
  for (const a of all) console.log(`  ${a.slug.padEnd(22)} active=${a.isActive} ${a.startsAt.toISOString().slice(0,16)} → ${a.endsAt.toISOString().slice(0,16)}`)
}
main().then(() => process.exit(0))
