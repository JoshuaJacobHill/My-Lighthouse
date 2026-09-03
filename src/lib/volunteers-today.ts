/**
 * Who is expected in today, per store.
 *
 * The coordinator's question first thing in the morning is simply "who am I
 * expecting, and when?" — so this returns exactly that, grouped by store and
 * ordered by start time.
 *
 * Confirmed and still-unanswered bookings both appear, because a coordinator
 * needs to know about someone who has not replied at least as much as someone
 * who has. They are marked, not filtered: the alternative is a list that looks
 * settled when it isn't.
 */

import prisma from '@/lib/prisma'
import { brisbaneToday } from '@/lib/fitness-days'

const BNE = 'Australia/Brisbane'

export type ExpectedVolunteer = {
  name: string
  start: string
  end: string
  confirmed: boolean
  shiftTitle: string | null
}

export type StoreDay = {
  location: string
  volunteers: ExpectedVolunteer[]
}

function timeLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: BNE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(/:00/, '')
    .toLowerCase()
    .replace(/\s/g, '')
}

/** The Brisbane day as a UTC instant range, so a shift is caught by local date. */
function brisbaneDayRange(day: string): { from: Date; to: Date } {
  // Queensland has no daylight saving, so a fixed +10:00 is always correct.
  return {
    from: new Date(`${day}T00:00:00.000+10:00`),
    to: new Date(`${day}T23:59:59.999+10:00`),
  }
}

/** Today's expected volunteers, grouped by store. Stores with nobody are omitted. */
export async function getVolunteersExpected(day = brisbaneToday()): Promise<StoreDay[]> {
  const { from, to } = brisbaneDayRange(day)

  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      shift: { date: { gte: from, lte: to }, isActive: true },
    },
    select: {
      status: true,
      shift: {
        select: {
          startTime: true,
          endTime: true,
          title: true,
          location: { select: { name: true } },
        },
      },
      volunteer: {
        select: { firstName: true, lastName: true },
      },
    },
  })

  const byStore = new Map<string, ExpectedVolunteer[]>()
  for (const a of assignments) {
    const store = a.shift.location?.name ?? 'Unknown'
    const list = byStore.get(store) ?? []
    list.push({
      name: `${a.volunteer.firstName} ${a.volunteer.lastName}`.trim(),
      start: timeLabel(a.shift.startTime),
      end: timeLabel(a.shift.endTime),
      confirmed: a.status === 'CONFIRMED',
      shiftTitle: a.shift.title ?? null,
    })
    byStore.set(store, list)
  }

  return [...byStore.entries()]
    .map(([location, volunteers]) => ({
      location,
      volunteers: volunteers.sort(
        (x, y) => x.start.localeCompare(y.start) || x.name.localeCompare(y.name),
      ),
    }))
    .filter((s) => s.volunteers.length > 0)
    .sort((a, b) => a.location.localeCompare(b.location))
}

/** Friendly date for the subject line and heading. */
export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: BNE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${day}T02:00:00.000+10:00`))
}
