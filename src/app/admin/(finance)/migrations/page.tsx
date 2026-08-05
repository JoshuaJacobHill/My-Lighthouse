import prisma from '@/lib/prisma'
import { MigrationsClient } from './MigrationsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Donor Migration | Lighthouse Care Admin' }

export default async function MigrationsPage() {
  // Gated by the (finance) layout — donations access required.
  const [funds, intents] = await Promise.all([
    prisma.fund.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true },
    }),
    prisma.migrationIntent.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        token: true,
        email: true,
        donorName: true,
        donorCompany: true,
        amountCents: true,
        frequency: true,
        status: true,
        emailSentAt: true,
        completedAt: true,
      },
    }),
  ])

  const rows = intents.map((i) => ({
    ...i,
    emailSentAt: i.emailSentAt ? i.emailSentAt.toISOString() : null,
    completedAt: i.completedAt ? i.completedAt.toISOString() : null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Donor migration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Move recurring givers across from Shout for Good. Import them, then send each a warm “re-confirm your card”
          email — their gift details are pre-filled, so all they do is re-enter their card. Once they confirm, they’re
          emailed automatically to set a password and manage their giving.
        </p>
      </div>

      <MigrationsClient funds={funds} intents={rows} />
    </div>
  )
}
