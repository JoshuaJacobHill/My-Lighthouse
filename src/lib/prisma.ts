import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL!
  // max:2 is optimal for serverless — each function instance needs at most
  // one connection; a small pool lets queries pipeline without overloading
  // Supabase's PgBouncer pooler.
  const adapter = new PrismaPg({ connectionString, max: 2 })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

// Re-use the same client across hot-reloads in dev, and across invocations
// in the same Vercel function instance in production.
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma

export default prisma
