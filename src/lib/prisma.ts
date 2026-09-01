import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * One client, reused for the life of the process.
 *
 * Opening a connection costs about 137ms against the pooler, against 26ms for a
 * query on a warm one, so reuse is worth more than any query tuning. The client
 * is kept on globalThis in every environment: in development that survives hot
 * reloads, and in production it survives a module being evaluated more than
 * once, which otherwise leaves orphaned pools behind and makes every request
 * pay for a fresh connection.
 *
 * The pool stays small because Supavisor is already pooling in front of
 * Postgres; a big pool per serverless instance just holds connections open
 * without making anything faster. keepAlive stops idle sockets being dropped
 * between invocations, which is exactly the case that was paying to reconnect.
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma

export default prisma
