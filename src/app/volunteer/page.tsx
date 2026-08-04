import * as React from 'react'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import {
  Clock,
  Calendar,
  CalendarCheck,
  CalendarDays,
  User,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  CalendarPlus,
} from 'lucide-react'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My Dashboard',
}

const BRISBANE_TZ = 'Australia/Brisbane'

function formatAustralianDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
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
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Greeting */}
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-400">Welcome back</p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Hi, {volunteer.firstName} <span className="font-normal">👋</span>
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Member since {formatAustralianDate(volunteer.joinedAt)}
            </p>
          </div>
          <StatusBadge status={volunteer.status} />
        </header>

        {/* Induction alert */}
        {volunteer.status === 'PENDING_INDUCTION' && (
          <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-[28px] bg-amber-50 p-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <p className="font-semibold text-amber-900">Complete your induction to start volunteering</p>
                <p className="mt-0.5 text-sm text-amber-700">
                  Just a few sections to work through first.
                  {totalInductionSections > 0 &&
                    ` (${completedSections} of ${totalInductionSections} done)`}
                </p>
              </div>
            </div>
            <Link
              href="/volunteer/induction"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Start induction <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Induction complete celebration */}
        {volunteer.status === 'ACTIVE' && !volunteer.lastAttendedAt && (
          <div className="mb-8 flex items-start gap-3 rounded-[28px] bg-green-50 p-6">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-green-900">Induction complete — welcome to the family!</p>
              <p className="mt-0.5 text-sm text-green-700">
                You&rsquo;re now part of the Lighthouse Care volunteer team. We can&rsquo;t wait to see you on
                your first shift!
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <section className="mb-12 grid grid-cols-2 gap-5 sm:grid-cols-3">
          <StatTile icon={<Clock className="h-6 w-6" />} value={totalHours} label="Hours volunteered" accent />
          <StatTile icon={<CalendarCheck className="h-6 w-6" />} value={totalSessions} label="Shifts attended" />
          <StatTile
            icon={<CalendarDays className="h-6 w-6" />}
            value={volunteer.lastAttendedAt ? formatAustralianDate(volunteer.lastAttendedAt) : '—'}
            label="Last attended"
            small
          />
        </section>

        {/* Upcoming shifts */}
        <section className="mb-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-3xl font-normal tracking-tight sm:text-[2rem]">
              Your upcoming <span className="font-extrabold">shifts</span>
            </h2>
            <Link
              href="/volunteer/shifts"
              className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {upcomingAssignments.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-neutral-300 p-10 text-center">
              <Calendar className="mx-auto mb-3 h-10 w-10 text-neutral-300" aria-hidden="true" />
              <p className="font-medium text-neutral-600">No upcoming shifts rostered</p>
              <Link
                href="/volunteer/roster"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Book a shift <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-col gap-3 rounded-[28px] border border-neutral-200 p-6 sm:flex-row sm:items-center"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                    <Calendar className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-950">
                      {formatAustralianDate(assignment.shift.date)}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {formatTime(assignment.shift.startTime)} – {formatTime(assignment.shift.endTime)} ·{' '}
                      {assignment.shift.location.name}
                      {assignment.shift.department && ` · ${assignment.shift.department.name}`}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      SHIFT_STATUS_COLOURS[assignment.status] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {SHIFT_STATUS_LABELS[assignment.status] ?? assignment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-6 text-3xl font-normal tracking-tight sm:text-[2rem]">
            Quick <span className="font-extrabold">actions</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quickActions.map(({ href, icon: Icon, label, description }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-4 rounded-[28px] border border-neutral-200 p-6 transition-shadow hover:shadow-lg hover:shadow-neutral-200/60"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950">{label}</p>
                  <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-neutral-300 transition-colors group-hover:text-orange-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function StatTile({
  icon,
  value,
  label,
  accent,
  small,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className={`rounded-[28px] p-7 ${accent ? 'bg-orange-500 text-white' : 'border border-neutral-200 text-neutral-950'}`}>
      <span className={accent ? 'text-white' : 'text-orange-500'}>{icon}</span>
      <p className={(small ? 'text-xl sm:text-2xl' : 'text-5xl') + ' mt-5 font-extrabold tracking-tighter tabular-nums'}>
        {value}
      </p>
      <p className={`mt-1 text-sm ${accent ? 'text-orange-100' : 'text-neutral-500'}`}>{label}</p>
    </div>
  )
}
