import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ServingTeamsAdmin } from '@/components/admin/ServingTeamsAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Serving Teams | Lighthouse Care Admin' }

export default async function AdminTeamsPage() {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) redirect('/login')

  const teams = await prisma.servingTeam.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      interests: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  const data = teams.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isActive: t.isActive,
    interests: t.interests.map((i) => ({
      id: i.id,
      userId: i.user.id,
      name: i.user.name || i.user.email,
      email: i.user.email,
      when: i.createdAt.toLocaleDateString('en-AU'),
    })),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Serving teams</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Church serving teams and who&rsquo;s expressed interest. Church members see active teams on their Volunteer
          tab.
        </p>
      </div>
      <ServingTeamsAdmin teams={data} />
    </div>
  )
}
