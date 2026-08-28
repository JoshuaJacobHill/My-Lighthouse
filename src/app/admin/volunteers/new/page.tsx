import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { NewVolunteerForm } from '@/components/admin/NewVolunteerForm'
import { requireCapability } from '@/lib/permissions'

export default async function NewVolunteerPage() {
  await requireCapability('care.people')
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/volunteers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Volunteers
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Add Volunteer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new volunteer profile manually. The volunteer will be able to log in using the
          email address below.
        </p>
      </div>
      <NewVolunteerForm />
    </div>
  )
}
