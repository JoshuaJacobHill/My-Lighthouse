import Link from 'next/link'
import { startOfWeek, startOfMonth, subDays } from 'date-fns'
import prisma from '@/lib/prisma'
import { formatDate, formatDateTime, formatDuration } from '@/lib/utils'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { AttendanceTableClient, type AttendanceRow } from '@/components/admin/AttendanceTableClient'
import { clsx } from 'clsx'

export const dynamic = 'force-dynamic'

type Tab = 'all' | 'no-shows' | 'inactive' | 'guests'
type Range = 'week' | 'month' | 'all'

interface SearchParams {
  tab?: string
  range?: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All Attendance' },
  { id: 'no-shows', label: 'No-Shows' },
  { id: 'inactive', label: 'Inactive Volunteers' },
  { id: 'guests', label: 'Guest Sign-ins' },
]

const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
]

function TabLink({
  id,
  label,
  active,
  currentParams,
}: {
  id: string
  label: string
  active: boolean
  currentParams: SearchParams
}) {
  const sp = new URLSearchParams()
  sp.set('tab', id)
  if (currentParams.range) sp.set('range', currentParams.range)
  return (
    <Link
      href={`/admin/attendance?${sp.toString()}`}
      className={clsx(
        'shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-orange-500 text-orange-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      )}
    >
      {label}
    </Link>
  )
}

function RangeLink({
  id,
  label,
  active,
  currentParams,
}: {
  id: string
  label: string
  active: boolean
  currentParams: SearchParams
}) {
  const sp = new URLSearchParams()
  if (currentParams.tab) sp.set('tab', currentParams.tab)
  sp.set('range', id)
  return (
    <Link
      href={`/admin/attendance?${sp.toString()}`}
      className={clsx(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-orange-500 text-white'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
      )}
    >
      {label}
    </Link>
  )
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const activeTab = (params.tab as Tab) ?? 'all'
  const activeRange = (params.range as Range) ?? 'week'

  const now = new Date()
  const rangeStart: Date | null =
    activeRange === 'week'
      ? startOfWeek(now, { weekStartsOn: 1 })
      : activeRange === 'month'
      ? startOfMonth(now)
      : null

  const dateFilter = rangeStart ? { gte: rangeStart } : undefined

  // ── All attendance ──────────────────────────────────────────────────────────
  let allAttendance: Array<{
    id: string
    signInAt: Date
    signOutAt: Date | null
    durationMins: number | null
    volunteer: { firstName: string; lastName: string; id: string }
    location: { id: string; name: string } | null
  }> = []

  // ── No-shows ────────────────────────────────────────────────────────────────
  let noShows: Array<{
    id: string
    shift: {
      date: Date
      location: { name: string }
      department: { name: string } | null
    }
    volunteer: { firstName: string; lastName: string; id: string }
  }> = []

  // ── Inactive ────────────────────────────────────────────────────────────────
  let inactiveVolunteers: Array<{
    id: string
    firstName: string
    lastName: string
    status: string
    lastAttendedAt: Date | null
    joinedAt: Date
    preferredLocations: string[]
  }> = []

  // ── Guests ──────────────────────────────────────────────────────────────────
  let guestSignins: Array<{
    id: string
    firstName: string
    lastName: string
    mobile: string | null
    volunteerArea: string | null
    signInAt: Date
    signOutAt: Date | null
    durationMins: number | null
    location: { name: string } | null
  }> = []

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  if (activeTab === 'all') {
    allAttendance = await prisma.attendanceRecord.findMany({
      where: {
        ...(dateFilter ? { signInAt: dateFilter } : {}),
      },
      include: {
        volunteer: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { signInAt: 'desc' },
      take: 200,
    })
  } else if (activeTab === 'no-shows') {
    noShows = await prisma.shiftAssignment.findMany({
      where: {
        status: 'NO_SHOW',
        ...(dateFilter ? { shift: { date: dateFilter } } : {}),
      },
      include: {
        shift: {
          include: {
            location: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        volunteer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { shift: { date: 'desc' } },
      take: 200,
    })
  } else if (activeTab === 'inactive') {
    const cutoff = subDays(now, 14)
    inactiveVolunteers = await prisma.volunteerProfile.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ lastAttendedAt: null }, { lastAttendedAt: { lt: cutoff } }],
      },
      orderBy: [{ lastAttendedAt: 'asc' }],
    })
  } else if (activeTab === 'guests') {
    guestSignins = await prisma.guestAttendanceRecord.findMany({
      where: {
        ...(dateFilter ? { signInAt: dateFilter } : {}),
      },
      include: {
        location: { select: { name: true } },
      },
      orderBy: { signInAt: 'desc' },
      take: 200,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review volunteer attendance, no-shows, and inactivity across Lighthouse Care.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200">
        {TABS.map((tab) => (
          <TabLink
            key={tab.id}
            id={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            currentParams={params}
          />
        ))}
      </div>

      {/* Date range filter (not shown on inactive tab) */}
      {activeTab !== 'inactive' && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 mr-1">Period:</span>
          {RANGES.map((r) => (
            <RangeLink
              key={r.id}
              id={r.id}
              label={r.label}
              active={activeRange === r.id}
              currentParams={params}
            />
          ))}
        </div>
      )}

      {/* Content */}
      {activeTab === 'all' && (
        <AttendanceTableClient
          records={allAttendance.map((r): AttendanceRow => ({
            id: r.id,
            signInAt: r.signInAt.toISOString(),
            signOutAt: r.signOutAt?.toISOString() ?? null,
            durationMins: r.durationMins,
            volunteer: r.volunteer,
            location: r.location,
          }))}
          locations={locations}
          totalMins={allAttendance.reduce((s, r) => s + (r.durationMins ?? 0), 0)}
        />
      )}
      {activeTab === 'no-shows' && (
        <NoShowsTable records={noShows} />
      )}
      {activeTab === 'inactive' && (
        <InactiveTable volunteers={inactiveVolunteers} />
      )}
      {activeTab === 'guests' && (
        <GuestsTable records={guestSignins} />
      )}
    </div>
  )
}

// ─── Sub-tables ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}


function NoShowsTable({
  records,
}: {
  records: Array<{
    id: string
    shift: {
      date: Date
      location: { name: string }
      department: { name: string } | null
    }
    volunteer: { id: string; firstName: string; lastName: string }
  }>
}) {
  if (records.length === 0) {
    return <EmptyState message="No no-shows recorded in this period — great work!" />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Volunteer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Shift Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Department</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/volunteers/${r.volunteer.id}`}
                    className="font-medium text-orange-600 hover:text-orange-700"
                  >
                    {r.volunteer.firstName} {r.volunteer.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDate(r.shift.date)}</td>
                <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{r.shift.location.name}</td>
                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{r.shift.department?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InactiveTable({
  volunteers,
}: {
  volunteers: Array<{
    id: string
    firstName: string
    lastName: string
    status: string
    lastAttendedAt: Date | null
    joinedAt: Date
    preferredLocations: string[]
  }>
}) {
  if (volunteers.length === 0) {
    return (
      <EmptyState message="All active volunteers have attended recently — wonderful!" />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        {volunteers.length} active volunteer{volunteers.length !== 1 ? 's' : ''} haven&apos;t
        attended in the last 14 days (or have never attended).
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Volunteer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Last Attended</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Locations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {volunteers.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/volunteers/${v.id}`}
                      className="font-medium text-orange-600 hover:text-orange-700"
                    >
                      {v.firstName} {v.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status as Parameters<typeof StatusBadge>[0]['status']} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {v.lastAttendedAt
                      ? formatDate(v.lastAttendedAt)
                      : <span className="text-gray-400">Never</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {formatDate(v.joinedAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                    {v.preferredLocations.join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function GuestsTable({
  records,
}: {
  records: Array<{
    id: string
    firstName: string
    lastName: string
    mobile: string | null
    volunteerArea: string | null
    signInAt: Date
    signOutAt: Date | null
    durationMins: number | null
    location: { name: string } | null
  }>
}) {
  if (records.length === 0) {
    return <EmptyState message="No guest sign-ins recorded in this period." />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Mobile</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Area</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Sign In</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Sign Out</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {r.firstName} {r.lastName}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                  {r.mobile ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                  {r.volunteerArea ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{formatDateTime(r.signInAt)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {r.signOutAt ? formatDateTime(r.signOutAt) : (
                    <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      On site
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-900 hidden md:table-cell">
                  {r.durationMins != null ? formatDuration(r.durationMins) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                  {r.location?.name ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
