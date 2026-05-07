import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Attendance',
}

const BRISBANE_TZ = 'Australia/Brisbane'

function formatAustralianDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: BRISBANE_TZ,
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: BRISBANE_TZ,
  })
}

function formatDuration(mins: number | null): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default async function AttendancePage() {
  const session = await getSession()
  if (!session?.volunteerId) redirect('/login')

  const volunteerId = session.volunteerId

  const [records, noShowAssignments] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { volunteerId },
      orderBy: { signInAt: 'desc' },
      include: { location: true },
    }),
    prisma.shiftAssignment.findMany({
      where: { volunteerId, status: 'NO_SHOW' },
      include: {
        shift: {
          include: { location: true, department: true },
        },
      },
      orderBy: { shift: { date: 'desc' } },
    }),
  ])

  const totalMinutes = records.reduce((sum, r) => sum + (r.durationMins ?? 0), 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMins = totalMinutes % 60
  const totalHoursDisplay = totalHours > 0
    ? remainingMins > 0 ? `${totalHours}h ${remainingMins}m` : `${totalHours}h`
    : `${totalMinutes}m`

  const avgDuration = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + (r.durationMins ?? 0), 0) / records.filter(r => r.durationMins).length)
    : 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          A record of your volunteering sessions with Lighthouse Care.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total hours</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{totalHoursDisplay}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sessions</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{records.length}</p>
          </CardContent>
        </Card>
        {records.filter(r => r.durationMins).length > 0 && (
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg. session</p>
              <p className="mt-1 text-2xl font-bold text-orange-600">{formatDuration(avgDuration)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Attendance table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-500">No attendance records yet.</p>
              <p className="text-sm text-gray-400 mt-1">Your sessions will appear here once you&apos;ve signed in at a Lighthouse Care location.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Location</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Sign in</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Sign out</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {formatAustralianDate(record.signInAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {record.location?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatTime(record.signInAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {record.signOutAt ? formatTime(record.signOutAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDuration(record.durationMins)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* No-shows */}
      {noShowAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-700">Missed Shifts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Location</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {noShowAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {formatAustralianDate(assignment.shift.date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {assignment.shift.location.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {assignment.shift.department?.name ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
