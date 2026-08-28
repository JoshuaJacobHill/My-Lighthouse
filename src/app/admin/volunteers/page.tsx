import Link from 'next/link'
import { UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { VolunteerFilters } from '@/components/admin/VolunteerFilters'
import { ExportCSVButton } from '@/components/admin/ExportCSVButton'
import { DeleteVolunteerButton } from '@/components/admin/DeleteVolunteerButton'
import { ImportVolunteersModal } from '@/components/admin/ImportVolunteersModal'
import { formatDate } from '@/lib/utils'
import type { VolunteerStatus } from '@prisma/client'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; location?: string; page?: string }>
}) {
  await requireCapability('care.people')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const skip = (page - 1) * PAGE_SIZE

  // When no status is selected, hide REMOVED volunteers by default.
  // Selecting "Removed" from the filter explicitly shows only removed.
  const statusFilter: object = params.status
    ? { status: params.status as VolunteerStatus }
    : { status: { not: 'REMOVED' as VolunteerStatus } }

  const where = {
    ...(params.search
      ? {
          OR: [
            { firstName: { contains: params.search, mode: 'insensitive' as const } },
            { lastName: { contains: params.search, mode: 'insensitive' as const } },
            { email: { contains: params.search, mode: 'insensitive' as const } },
            { mobile: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...statusFilter,
    ...(params.location ? { preferredLocations: { has: params.location } } : {}),
  }

  const [volunteers, total, removedCount] = await Promise.all([
    prisma.volunteerProfile.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.volunteerProfile.count({ where }),
    // Only fetch this count when not already filtering by a status
    !params.status
      ? prisma.volunteerProfile.count({ where: { status: 'REMOVED' } })
      : Promise.resolve(0),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function buildPageUrl(p: number) {
    const sp = new URLSearchParams()
    if (params.search) sp.set('search', params.search)
    if (params.status) sp.set('status', params.status)
    if (params.location) sp.set('location', params.location)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/admin/volunteers${qs ? `?${qs}` : ''}`
  }

  // Build the "show removed" URL preserving other filters
  function buildShowRemovedUrl() {
    const sp = new URLSearchParams()
    if (params.search) sp.set('search', params.search)
    if (params.location) sp.set('location', params.location)
    sp.set('status', 'REMOVED')
    return `/admin/volunteers?${sp.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Volunteers</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} volunteer{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCSVButton />
          <ImportVolunteersModal />
          <Button asChild size="sm">
            <Link href="/admin/volunteers/new">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add Volunteer
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <VolunteerFilters />

      {/* Removed-volunteers hint */}
      {!params.status && removedCount > 0 && (
        <p className="text-sm text-gray-500">
          {removedCount} removed volunteer{removedCount !== 1 ? 's' : ''} not shown.{' '}
          <Link
            href={buildShowRemovedUrl()}
            className="font-medium text-orange-600 hover:text-orange-700 underline underline-offset-2"
          >
            Show removed
          </Link>
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {volunteers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">
              No volunteers match your search. Try adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">
                    Mobile
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden xl:table-cell">
                    Locations
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">
                    Last Attended
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {volunteers.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={`${v.firstName} ${v.lastName}`}
                          src={v.avatarUrl ?? undefined}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {v.firstName} {v.lastName}
                          </p>
                          <p className="text-xs text-gray-500 md:hidden truncate">
                            {v.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {v.email}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {v.mobile}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-gray-600">
                        {v.preferredLocations.length > 0
                          ? v.preferredLocations.join(', ')
                          : <span className="text-gray-400">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {v.lastAttendedAt
                        ? formatDate(v.lastAttendedAt)
                        : <span className="text-gray-400">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/volunteers/${v.id}`}
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          View
                        </Link>
                        <Link
                          href={`/admin/volunteers/${v.id}/edit`}
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          Edit
                        </Link>
                        <DeleteVolunteerButton
                          volunteerId={v.id}
                          volunteerName={`${v.firstName} ${v.lastName}`}
                          variant="icon"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between"
          aria-label="Pagination"
        >
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={buildPageUrl(page - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageUrl(page + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
