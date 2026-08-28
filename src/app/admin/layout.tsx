import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import AdminLayout from '@/components/layout/AdminLayout'
import { getCapabilities, isAdminRole } from '@/lib/permissions'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !isAdminRole(session.role)) {
    redirect('/login')
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) redirect('/login')
  const capabilities = await getCapabilities()
  return (
    <AdminLayout user={user} capabilities={capabilities}>
      {children}
    </AdminLayout>
  )
}
