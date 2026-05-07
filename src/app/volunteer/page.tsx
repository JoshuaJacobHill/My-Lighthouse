import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar, User, MessageSquare, AlertTriangle, CheckCircle2, ChevronRight, CalendarPlus } from 'lucide-react'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Dashboard',
}

function formatAustralianDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const SHIFT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED_BY_VOLUNTEER: 'Cancelled',
  ATTENDED: 'Attended',
  NO_SHOW: 'No Show',
  ADMIN_CANCELLED: 'Cancelled',
}

const SHIFT_STATUS_COLOURS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 border border-blue-200',
  CONFIRMED: 'bg-green-100 text-green-800 border border-green-200',
  CANCELLED_BY_VOLUNTEER: 'bg-gray-100 text-gray-700 border border-gray-200',
  ATTENDED: 'bg-orange-100 text-orange-700 border border-orange-200',
  NO_SHOW: 'bg-red-100 text-red-800 border border-red-200',
  ADMIN_CANCELLED: 'bg-gray-100 text-gray-700 border border-gray-200',
}

export default async function VolunteerDashboard() {
  const session = await getSession()
  if (!session?.volunteerId) redirect('/login')

  const volunteerId = session.volunteerId
  const now = new Date()

  const [volunteer, upcomingAssignments, recentAttendance, totalHoursResult, inductionSections, inductionProgress] =
    await Promise.all([
      prisma.volunteerProfile.findUnique({
        where: { id: volunteerId },
      }),
      prisma.shiftAssignment.findMany({
        where: {
          volunteerId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          shift: { date: { gte: now } },
        },
        include: {
          shift: {
            include: {
              location: true,
              department: true,
            },
          },
        },
        orderBy: { shift: { date: 'asc' } },
        take: 3,
      }),
      prisma.attendanceRecord.findMany({
        where: { volunteerId },
        orderBy: { signInAt: 'desc' },
        take: 5,
        include: { location: true },
      }),
      prisma.attendanceRecord.aggregate({
        where: { volunteerId, durationMins: { not: null } },
        _sum: { durationMins: true },
      }),
      prisma.inductionSection.findMany({
        where: { isActive: true },
        select: { id: true },
      }),
      prisma.inductionProgress.findMany({
        where: { volunteerId, completed: true },
        select: { sectionId: true },
      }),
    ])

  if (!volunteer) redirect('/login')

  const totalHours = Math.round((totalHoursResult._sum.durationMins ?? 0) / 60)
  const totalSessions = recentAttendance.length
  const totalInductionSections = inductionSections.length
  const completedSections = inductionProgress.length
  const inductionComplete = totalInductionSections > 0 && completedSections >= totalInductionSections

  const quickActions = [
    {
      href: '/volunteer/roster',
      icon: CalendarPlus,
      label: 'Book a Shift',
      description: 'Browse and book available shifts',
    },
    {
      href: '/volunteer/availability',
      icon: Clock,
      label: 'Update Availability',
      description: 'Let us know when you can volunteer',
    },
    {
      href: '/volunteer/profile',
      icon: User,
      label: 'My Profile',
      description: 'Keep your details up to date',
    },
    {
      href: '/volunteer/contact',
      icon: MessageSquare,
      label: 'Contact Admin',
      description: 'Send a message to our team',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {volunteer.firstName}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Member since {formatAustralianDate(volunteer.joinedAt)}
          </p>
        </div>
        <StatusBadge status={volunteer.status} />
      </div>

      {/* Induction alert */}
      {volunteer.status === 'PENDING_INDUCTION' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Complete your induction to start volunteering</p>
            <p className="mt-0.5 text-sm text-amber-700">
              You&apos;re almost ready to join the team — just a few sections to work through first.
              {totalInductionSections > 0 && (
                <span className="ml-1">
                  ({completedSections} of {totalInductionSections} sections done)
                </span>
              )}
            </p>
          </div>
          <Link
            href="/volunteer/induction"
            className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors bg-orange-500 text-white hover:bg-orange-600 h-8 shrink-0"
          >
            Start Induction <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Induction complete celebration — shown for newly ACTIVE volunteers who just passed */}
      {volunteer.status === 'ACTIVE' && !volunteer.lastAttendedAt && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-green-800">Induction complete — welcome to the family!</p>
            <p className="mt-0.5 text-sm text-green-700">
              You&apos;re now part of the Lighthouse Care volunteer team. We can&apos;t wait to see you on your first shift!
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hours volunteered</p>
            <p className="mt-1 text-3xl font-bold text-orange-600">{totalHours}</p>
            <p className="text-xs text-gray-400 mt-0.5">across all sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Shifts attended</p>
            <p className="mt-1 text-3xl font-bold text-orange-600">{totalSessions}</p>
            <p className="text-xs text-gray-400 mt-0.5">recorded sessions</p>
          </CardContent>
        </Card>
        {volunteer.lastAttendedAt && (
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last attended</p>
              <p className="mt-1 text-base font-semibold text-gray-700">
                {formatAustralianDate(volunteer.lastAttendedAt)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">most recent shift</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upcoming shifts */}
      <section aria-labelledby="upcoming-shifts-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="upcoming-shifts-heading" className="text-lg font-semibold text-gray-900">
            Your Upcoming Shifts
          </h2>
          <Link
            href="/volunteer/shifts"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors border border-orange-500 text-orange-500 bg-transparent hover:bg-orange-50 h-8"
          >
            View all
          </Link>
        </div>

        {upcomingAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-600">No upcoming shifts rostered</p>
              <p className="text-sm text-gray-400 mt-1">
                Our team will reach out when there&apos;s a shift that suits your availability.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingAssignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAustralianDate(assignment.shift.date)}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatTime(assignment.shift.startTime)} – {formatTime(assignment.shift.endTime)}
                      {' · '}{assignment.shift.location.name}
                      {assignment.shift.department && ` · ${assignment.shift.department.name}`}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${
                      SHIFT_STATUS_COLOURS[assignment.status] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {SHIFT_STATUS_LABELS[assignment.status] ?? assignment.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-lg font-semibold text-gray-900 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map(({ href, icon: Icon, label, description }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 group-hover:bg-orange-100 transition-colors shrink-0">
                    <Icon className="h-5 w-5 text-orange-500" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-orange-500 ml-auto shrink-0 transition-colors" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
