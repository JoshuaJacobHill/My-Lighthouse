import * as React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  isToday,
} from 'date-fns'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AddShiftModal } from './AddShiftModal'
import { RosterActions } from './RosterActions'
import { RosterControls } from './RosterControls'
import { AssignVolunteerModal } from './AssignVolunteerModal'
import { GenerateShiftsButton } from './GenerateShiftsButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Roster | Lighthouse Care Admin' }

interface PageProps {
  searchParams: Promise<{
    week?: string
    view?: string
    location?: string
    date?: string
    month?: string
  }>
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED_BY_VOLUNTEER: 'bg-red-100 text-red-700',
  ATTENDED: 'bg-orange-100 text-orange-600',
  NO_SHOW: 'bg-orange-100 text-orange-700',
  ADMIN_CANCELLED: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED_BY_VOLUNTEER: 'Cancelled',
  ATTENDED: 'Attended',
  NO_SHOW: 'No Show',
  ADMIN_CANCELLED: 'Admin Cancelled',
}

function getWeekStart(weekParam?: string): Date {
  if (weekParam) {
    try {
      const parsed = parseISO(weekParam)
      if (!isNaN(parsed.getTime())) {
        return startOfWeek(parsed, { weekStartsOn: 1 })
      }
    } catch {
      // fall through
    }
  }
  return startOfWeek(new Date(), { weekStartsOn: 1 })
}

function getViewDate(dateParam?: string): Date {
  if (dateParam) {
    try {
      const parsed = parseISO(dateParam)
      if (!isNaN(parsed.getTime())) return parsed
    } catch {
      // fall through
    }
  }
  return new Date()
}

function getMonthStart(monthParam?: string): Date {
  if (monthParam) {
    try {
      // monthParam is YYYY-MM
      const parsed = parseISO(`${monthParam}-01`)
      if (!isNaN(parsed.getTime())) return startOfMonth(parsed)
    } catch {
      // fall through
    }
  }
  return startOfMonth(new Date())
}

// Dot colours per location index
const DOT_COLOURS = [
  'bg-orange-400',
  'bg-blue-400',
  'bg-green-400',
  'bg-purple-400',
  'bg-pink-400',
  'bg-amber-400',
]

export default async function RosterPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login')
  }

  const params = await searchParams
  const view = (params.view === 'day' || params.view === 'month') ? params.view : 'week'
  const locationFilter = params.location ?? ''

  const [locations, departments] = await Promise.all([
    prisma.location.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ])

  // Build location colour map for month view dots
  const locationColourMap: Record<string, string> = {}
  locations.forEach((loc, idx) => {
    locationColourMap[loc.id] = DOT_COLOURS[idx % DOT_COLOURS.length]
  })

  // ─── Compute date ranges ──────────────────────────────────────────────────────

  let rangeStart: Date
  let rangeEnd: Date

  const weekStart = getWeekStart(params.week)
  const viewDate = getViewDate(params.date)
  const monthStart = getMonthStart(params.month)

  if (view === 'day') {
    rangeStart = startOfDay(viewDate)
    rangeEnd = endOfDay(viewDate)
  } else if (view === 'month') {
    rangeStart = monthStart
    rangeEnd = endOfMonth(monthStart)
  } else {
    rangeStart = weekStart
    rangeEnd = addDays(weekStart, 7)
  }

  // ─── Fetch shifts ─────────────────────────────────────────────────────────────

  const shifts = await prisma.shift.findMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
      isActive: true,
      ...(locationFilter ? { locationId: locationFilter } : {}),
    },
    include: {
      location: true,
      department: true,
      assignments: {
        include: {
          volunteer: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })

  // ─── Build shift cards ────────────────────────────────────────────────────────

  function ShiftCard({ shift }: { shift: typeof shifts[0] }) {
    const assignedCount = shift.assignments.filter(
      (a) => a.status !== 'ADMIN_CANCELLED' && a.status !== 'CANCELLED_BY_VOLUNTEER'
    ).length
    const isFull = assignedCount >= shift.capacity

    return (
      <div className="px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            {/* Shift info */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">
                {format(new Date(shift.startTime), 'h:mm a')} —{' '}
                {format(new Date(shift.endTime), 'h:mm a')}
              </span>
              {shift.title && (
                <span className="text-gray-600 text-sm">· {shift.title}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-3">
              <span className="font-medium text-gray-700">{shift.location.name}</span>
              {shift.department && (
                <>
                  <span>·</span>
                  <span>{shift.department.name}</span>
                </>
              )}
              <span>·</span>
              <span className={`font-medium ${isFull ? 'text-green-600' : 'text-amber-600'}`}>
                {assignedCount}/{shift.capacity} filled
              </span>
            </div>

            {/* Assigned volunteers */}
            {shift.assignments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {shift.assignments.map((assignment) => (
                  <span
                    key={assignment.id}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      STATUS_STYLES[assignment.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {assignment.volunteer.firstName} {assignment.volunteer.lastName}
                    <span className="opacity-60">
                      · {STATUS_LABELS[assignment.status] ?? assignment.status}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {shift.notes && (
              <p className="mt-2 text-xs text-gray-400 italic">{shift.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <AssignVolunteerModal
              shiftId={shift.id}
              assignedCount={assignedCount}
              capacity={shift.capacity}
              currentAssignments={shift.assignments.map((a) => ({
                volunteerId: a.volunteerId,
                status: a.status,
              }))}
            />
            <RosterActions
              shift={{
                id: shift.id,
                date: shift.date.toISOString(),
                startTime: shift.startTime.toISOString(),
                endTime: shift.endTime.toISOString(),
                locationId: shift.locationId,
                departmentId: shift.departmentId,
                title: shift.title,
                capacity: shift.capacity,
                notes: shift.notes,
              }}
              locations={locations.map((l) => ({ id: l.id, name: l.name }))}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            />
          </div>
        </div>
      </div>
    )
  }

  // ─── Navigation URLs ──────────────────────────────────────────────────────────

  const baseParams = locationFilter ? `&location=${locationFilter}` : ''

  // Week navigation
  const prevWeek = format(addDays(weekStart, -7), 'yyyy-MM-dd')
  const nextWeek = format(addDays(weekStart, 7), 'yyyy-MM-dd')
  const thisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // Day navigation
  const prevDay = format(addDays(viewDate, -1), 'yyyy-MM-dd')
  const nextDay = format(addDays(viewDate, 1), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  // Month navigation
  const prevMonth = format(addMonths(monthStart, -1), 'yyyy-MM')
  const nextMonth = format(addMonths(monthStart, 1), 'yyyy-MM')
  const thisMonth = format(new Date(), 'yyyy-MM')

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {view === 'day' && `${format(viewDate, 'd MMMM yyyy')}`}
            {view === 'week' && `Week of ${format(weekStart, 'd MMMM yyyy')}`}
            {view === 'month' && `${format(monthStart, 'MMMM yyyy')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateShiftsButton />
          <AddShiftModal
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            weekStart={view === 'week' ? weekStart.toISOString() : view === 'day' ? viewDate.toISOString() : monthStart.toISOString()}
          />
        </div>
      </div>

      {/* Controls row: view toggle + location filter */}
      <RosterControls
        view={view}
        locationId={locationFilter}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        currentDate={format(viewDate, 'yyyy-MM-dd')}
        currentWeek={format(weekStart, 'yyyy-MM-dd')}
        currentMonth={format(monthStart, 'yyyy-MM')}
      />

      {/* ── DAY VIEW ─────────────────────────────────────────────────────────── */}
      {view === 'day' && (
        <div className="space-y-4">
          {/* Day navigation */}
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/roster?view=day&date=${prevDay}${baseParams}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              ← Previous Day
            </Link>
            <Link
              href={`/admin/roster?view=day&date=${today}${baseParams}`}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-100 transition-colors"
            >
              Today
            </Link>
            <Link
              href={`/admin/roster?view=day&date=${nextDay}${baseParams}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Next Day →
            </Link>
          </div>

          {/* Group by location */}
          {shifts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-sm text-gray-400 text-center">
              No shifts rostered for {format(viewDate, 'EEEE d MMMM yyyy')}.
            </div>
          ) : (
            (() => {
              const byLocation = locations
                .map((loc) => ({
                  location: loc,
                  dayShifts: shifts.filter((s) => s.locationId === loc.id),
                }))
                .filter(({ dayShifts }) => dayShifts.length > 0)

              return byLocation.map(({ location: loc, dayShifts }) => (
                <div key={loc.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{loc.name}</span>
                    <span className="text-xs text-gray-400">
                      {dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayShifts.map((shift) => (
                      <ShiftCard key={shift.id} shift={shift} />
                    ))}
                  </div>
                </div>
              ))
            })()
          )}
        </div>
      )}

      {/* ── WEEK VIEW ────────────────────────────────────────────────────────── */}
      {view === 'week' && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/roster?view=week&week=${prevWeek}${baseParams}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              ← Previous Week
            </Link>
            <Link
              href={`/admin/roster?view=week&week=${thisWeek}${baseParams}`}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-100 transition-colors"
            >
              This Week
            </Link>
            <Link
              href={`/admin/roster?view=week&week=${nextWeek}${baseParams}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Next Week →
            </Link>
          </div>

          {/* Week grid */}
          {DAYS.map((_, idx) => {
            const day = addDays(weekStart, idx)
            const dayShifts = shifts.filter((s) => isSameDay(new Date(s.date), day))

            return (
              <div key={day.toISOString()} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className={`font-semibold ${isToday(day) ? 'text-orange-600' : 'text-gray-900'}`}>
                      {format(day, 'EEEE')}
                    </span>
                    <span className="text-gray-500 ml-2 text-sm">{format(day, 'd MMMM')}</span>
                    {isToday(day) && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {dayShifts.length === 0
                      ? 'No shifts'
                      : `${dayShifts.length} shift${dayShifts.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                {dayShifts.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-gray-400 text-center">
                    No shifts rostered for this day.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {dayShifts.map((shift) => (
                      <ShiftCard key={shift.id} shift={shift} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── MONTH VIEW ───────────────────────────────────────────────────────── */}
      {view === 'month' && (
        <div className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/roster?view=month&month=${prevMonth}${baseParams}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              ← Previous Month
            </Link>
            <Link
              href={`/admin/roster?view=month&month=${thisMonth}${baseParams}`}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-100 transition-colors"
            >
              This Month
            </Link>
            <Link
              href={`/admin/roster?view=month&month=${nextMonth}${baseParams}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Next Month →
            </Link>
          </div>

          {/* Calendar grid */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div
                  key={d}
                  className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            {(() => {
              const firstDayOfMonth = monthStart
              // Start grid from Monday of the week containing the 1st
              const gridStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 })
              const lastDayOfMonth = endOfMonth(firstDayOfMonth)
              // End grid on Sunday of the week containing the last day
              const gridEnd = addDays(
                startOfWeek(lastDayOfMonth, { weekStartsOn: 1 }),
                6
              )
              const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

              // Chunk into weeks
              const weeks: Date[][] = []
              for (let i = 0; i < allDays.length; i += 7) {
                weeks.push(allDays.slice(i, i + 7))
              }

              return weeks.map((week, wi) => (
                <div key={wi} className={`grid grid-cols-7 ${wi < weeks.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  {week.map((day) => {
                    const inMonth = isSameMonth(day, firstDayOfMonth)
                    const dayShifts = shifts.filter((s) => isSameDay(new Date(s.date), day))
                    const dayStr = format(day, 'yyyy-MM-dd')

                    return (
                      <Link
                        key={dayStr}
                        href={`/admin/roster?view=day&date=${dayStr}${baseParams}`}
                        className={`min-h-[80px] p-2 border-r border-gray-100 last:border-r-0 hover:bg-orange-50/50 transition-colors group ${
                          !inMonth ? 'bg-gray-50/50' : ''
                        }`}
                      >
                        <div
                          className={`text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday(day)
                              ? 'bg-orange-500 text-white'
                              : inMonth
                              ? 'text-gray-900 group-hover:text-orange-600'
                              : 'text-gray-300'
                          }`}
                        >
                          {format(day, 'd')}
                        </div>
                        {dayShifts.length > 0 && (
                          <div className="space-y-0.5">
                            {dayShifts.slice(0, 3).map((shift) => (
                              <div
                                key={shift.id}
                                className={`rounded px-1 py-0.5 text-[10px] font-medium text-white truncate ${
                                  locationColourMap[shift.locationId] ?? 'bg-gray-400'
                                }`}
                              >
                                {format(new Date(shift.startTime), 'h:mma')}{' '}
                                {shift.location.name}
                              </div>
                            ))}
                            {dayShifts.length > 3 && (
                              <div className="text-[10px] text-gray-400 pl-1">
                                +{dayShifts.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              ))
            })()}
          </div>

          {/* Legend */}
          {locations.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {locations.map((loc) => (
                <div key={loc.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-sm ${locationColourMap[loc.id] ?? 'bg-gray-400'}`}
                  />
                  {loc.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
