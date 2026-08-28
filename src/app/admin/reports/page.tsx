import * as React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { subDays, subMonths, subQuarters, format, startOfDay } from 'date-fns'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ReportExportButton } from './ReportExportButton'
import { isAdminRole } from '@/lib/permissions-core'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Reports | Lighthouse Care Admin' }

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

type DateRange = 'week' | 'month' | 'quarter'

function getRangeStart(range: DateRange): Date {
  const now = new Date()
  switch (range) {
    case 'week':
      return startOfDay(subDays(now, 7))
    case 'quarter':
      return startOfDay(subQuarters(now, 1))
    case 'month':
    default:
      return startOfDay(subMonths(now, 1))
  }
}

function getRangeLabel(range: DateRange): string {
  switch (range) {
    case 'week':
      return 'Last 7 days'
    case 'quarter':
      return 'Last 3 months'
    case 'month':
    default:
      return 'Last 30 days'
  }
}

export default async function ReportsPage({ searchParams }: PageProps) {
  await requireCapability('care.people')
  const session = await getSession()
  if (!session || !isAdminRole(session.role)) {
    redirect('/login')
  }

  const params = await searchParams
  const range: DateRange =
    params.range === 'week' || params.range === 'quarter' ? params.range : 'month'
  const rangeStart = getRangeStart(range)
  const now = new Date()

  // ─── Queries ──────────────────────────────────────────────────────────────

  const [
    attendanceRecords,
    noShowAssignments,
    totalNoShowCheck,
    newVolunteers,
    locationAttendance,
    blueCardExpiries,
    allAssignmentsInPeriod,
  ] = await Promise.all([
    // All attended records in period
    prisma.attendanceRecord.findMany({
      where: { signInAt: { gte: rangeStart, lte: now } },
      include: {
        volunteer: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
      },
    }),

    // No-show assignments in period
    prisma.shiftAssignment.count({
      where: {
        status: 'NO_SHOW',
        shift: { date: { gte: rangeStart, lte: now } },
      },
    }),

    // Total attended + no-show assignments for rate calc
    prisma.shiftAssignment.count({
      where: {
        status: { in: ['ATTENDED', 'NO_SHOW'] },
        shift: { date: { gte: rangeStart, lte: now } },
      },
    }),

    // New volunteers registered in period
    prisma.volunteerProfile.count({
      where: { joinedAt: { gte: rangeStart, lte: now } },
    }),

    // Attendance grouped by location
    prisma.attendanceRecord.groupBy({
      by: ['locationId'],
      where: { signInAt: { gte: rangeStart, lte: now }, locationId: { not: null } },
      _count: { id: true },
      _sum: { durationMins: true },
    }),

    // Blue card expiries within 60 days
    prisma.volunteerProfile.findMany({
      where: {
        blueCardExpiry: {
          gte: now,
          lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        },
        status: { not: 'REMOVED' },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        blueCardExpiry: true,
        blueCardStatus: true,
      },
      orderBy: { blueCardExpiry: 'asc' },
    }),

    // For no-show report: assignments per volunteer
    prisma.shiftAssignment.findMany({
      where: {
        status: 'NO_SHOW',
        shift: { date: { gte: rangeStart, lte: now } },
      },
      include: {
        volunteer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
  ])

  // ─── Aggregate attendance by volunteer ────────────────────────────────────

  const volunteerMap = new Map<
    string,
    { id: string; firstName: string; lastName: string; totalMins: number; sessions: number }
  >()
  for (const record of attendanceRecords) {
    if (!record.volunteer) continue
    const existing = volunteerMap.get(record.volunteer.id)
    if (existing) {
      existing.totalMins += record.durationMins ?? 0
      existing.sessions += 1
    } else {
      volunteerMap.set(record.volunteer.id, {
        id: record.volunteer.id,
        firstName: record.volunteer.firstName,
        lastName: record.volunteer.lastName,
        totalMins: record.durationMins ?? 0,
        sessions: 1,
      })
    }
  }

  const topVolunteers = Array.from(volunteerMap.values())
    .sort((a, b) => b.totalMins - a.totalMins)
    .slice(0, 10)

  // ─── Total stats ──────────────────────────────────────────────────────────

  const totalMins = attendanceRecords.reduce((sum, r) => sum + (r.durationMins ?? 0), 0)
  const totalHours = Math.round(totalMins / 60)
  const totalSessions = attendanceRecords.length
  const noShowRate =
    totalNoShowCheck > 0
      ? Math.round((noShowAssignments / totalNoShowCheck) * 100)
      : 0

  // ─── Location data ────────────────────────────────────────────────────────

  const locationIds = locationAttendance.map((la) => la.locationId).filter(Boolean) as string[]
  const locationNames = await prisma.location.findMany({
    where: { id: { in: locationIds } },
    select: { id: true, name: true },
  })
  const locationNameMap = new Map(locationNames.map((l) => [l.id, l.name]))

  const locationStats = locationAttendance
    .map((la) => ({
      name: locationNameMap.get(la.locationId ?? '') ?? 'Unknown',
      count: la._count.id,
      hours: Math.round((la._sum.durationMins ?? 0) / 60),
    }))
    .sort((a, b) => b.count - a.count)

  const maxLocationCount = Math.max(...locationStats.map((l) => l.count), 1)

  // ─── No-show per volunteer ────────────────────────────────────────────────

  const noShowMap = new Map<
    string,
    {
      id: string
      firstName: string
      lastName: string
      email: string
      count: number
    }
  >()
  for (const a of allAssignmentsInPeriod) {
    const v = a.volunteer
    const existing = noShowMap.get(v.id)
    if (existing) {
      existing.count += 1
    } else {
      noShowMap.set(v.id, { ...v, count: 1 })
    }
  }
  const noShowList = Array.from(noShowMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">{getRangeLabel(range)}</p>
        </div>
        <ReportExportButton range={range} />
      </div>

      {/* Range selector */}
      <div className="flex gap-2">
        {(['week', 'month', 'quarter'] as DateRange[]).map((r) => (
          <Link
            key={r}
            href={`/admin/reports?range=${r}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              range === r
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : 'This Quarter'}
          </Link>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Hours" value={totalHours.toString()} />
        <StatCard label="Total Sessions" value={totalSessions.toString()} />
        <StatCard label="No-Show Rate" value={`${noShowRate}%`} />
        <StatCard label="New Volunteers" value={newVolunteers.toString()} />
      </div>

      {/* Top Volunteers */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Volunteers by Hours</h2>
        {topVolunteers.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-gray-400">
            No attendance records found for this period.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Volunteer</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Hours</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topVolunteers.map((v, idx) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/volunteers/${v.id}`}
                        className="font-medium text-orange-600 hover:underline"
                      >
                        {v.firstName} {v.lastName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {Math.round(v.totalMins / 60)}h
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">{v.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Attendance by Location */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance by Location</h2>
        {locationStats.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-gray-400">
            No location data for this period.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            {locationStats.map((loc) => (
              <div key={loc.name}>
                <div className="flex items-center justify-between mb-1.5 text-sm">
                  <span className="font-medium text-gray-700">{loc.name}</span>
                  <span className="text-gray-500">
                    {loc.count} sessions · {loc.hours}h
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{
                      width: `${Math.round((loc.count / maxLocationCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* No-Show Report */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">No-Show Report</h2>
        {noShowList.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-gray-400">
            No no-shows recorded for this period.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Volunteer</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">No-Shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {noShowList.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/volunteers/${v.id}`}
                        className="font-medium text-orange-600 hover:underline"
                      >
                        {v.firstName} {v.lastName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{v.email}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                        {v.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Blue Card Expiries */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Blue Card Expiries</h2>
        <p className="text-sm text-gray-500 mb-4">Volunteers with blue cards expiring within 60 days.</p>
        {blueCardExpiries.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-gray-400">
            No blue card expiries in the next 60 days.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Volunteer</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {blueCardExpiries.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/volunteers/${v.id}`}
                        className="font-medium text-orange-600 hover:underline"
                      >
                        {v.firstName} {v.lastName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{v.email}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {v.blueCardStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700 font-medium">
                      {v.blueCardExpiry ? format(new Date(v.blueCardExpiry), 'dd/MM/yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold text-gray-900">{value}</div>
    </div>
  )
}
