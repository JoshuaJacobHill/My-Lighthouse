import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import AdminLayout from '@/components/layout/AdminLayout'
import { canSeeDonations } from '@/lib/permissions'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    redirect('/login')
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) redirect('/login')
  return (
    <AdminLayout user={user} canSeeDonations={canSeeDonations(user)}>
      {children}
    </AdminLayout>
  )
}
