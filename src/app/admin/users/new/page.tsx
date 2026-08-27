import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { NewUserForm } from '@/components/admin/NewUserForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add User | Lighthouse Care Admin' }

export default async function NewUserPage() {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) redirect('/login')

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Add user</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Create a volunteer, staff member, church member or donor — or any combination.
        </p>
      </div>
      <NewUserForm />
    </div>
  )
}
