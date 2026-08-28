import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { Metadata } from 'next'
import { isAdminRole } from '@/lib/permissions-core'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const volunteer = await prisma.volunteerProfile.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  })
  if (!volunteer) return { title: 'Not Found' }
  return { title: `Edit ${volunteer.firstName} ${volunteer.lastName}` }
}

export default async function EditVolunteerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireCapability('care.people')
  const { id } = await params
  const session = await getSession()
  if (!session || !isAdminRole(session.role)) {
    redirect('/login')
  }

  const volunteer = await prisma.volunteerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      mobile: true,
      status: true,
      notes: true,
    },
  })

  if (!volunteer) notFound()

  async function updateVolunteerAction(formData: FormData) {
    'use server'

    const session = await getSession()
    if (!session || !isAdminRole(session.role)) {
      return
    }

    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const mobile = (formData.get('mobile') as string)?.trim()
    const status = formData.get('status') as string
    const notes = (formData.get('notes') as string)?.trim() || null

    if (!firstName || !lastName || !email || !mobile || !status) {
      return
    }

    await prisma.volunteerProfile.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email,
        mobile,
        status: status as never,
        notes,
      },
    })

    // Also update the user name to stay in sync
    const profile = await prisma.volunteerProfile.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (profile) {
      await prisma.user.update({
        where: { id: profile.userId },
        data: { name: `${firstName} ${lastName}`, email },
      })
    }

    revalidatePath(`/admin/volunteers/${id}`)
    revalidatePath(`/admin/volunteers/${id}/edit`)
    redirect(`/admin/volunteers/${id}`)
  }

  const STATUSES = [
    { value: 'PENDING_INDUCTION', label: 'Pending Induction' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'ON_LEAVE', label: 'On Leave' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'REMOVED', label: 'Removed' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href={`/admin/volunteers/${volunteer.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Profile
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          Edit {volunteer.firstName} {volunteer.lastName}
        </h1>

        <form action={updateVolunteerAction} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                defaultValue={volunteer.firstName}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                defaultValue={volunteer.lastName}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={volunteer.email}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div>
            <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              required
              defaultValue={volunteer.mobile}
              placeholder="04xx xxx xxx or 07 xxxx xxxx"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              name="status"
              required
              defaultValue={volunteer.status}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(admin only)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={volunteer.notes ?? ''}
              placeholder="Any notes about this volunteer..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/admin/volunteers/${volunteer.id}`}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
