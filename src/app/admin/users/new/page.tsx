import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NewUserForm } from '@/components/admin/NewUserForm'
import { getCapabilities, requireAnyCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add User | Lighthouse Care Admin' }

export default async function NewUserPage() {
  await requireAnyCapability(['care.people', 'church.members'])
  const capabilities = await getCapabilities()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Add user</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Create any combination of the kinds of supporter you look after.
        </p>
      </div>
      <NewUserForm capabilities={capabilities} />
    </div>
  )
}
