import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// ─── QLD Public Holiday Calculator ───────────────────────────────────────────
// Queensland does not observe daylight saving. All dates are local AEST.

/** Return the Easter Sunday date for a given year (Gregorian calendar). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Add days to a date, returning a new Date. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Format a Date as "YYYY-MM-DD" using local (UTC naive) values. */
function dateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns a Set of ISO date strings ("YYYY-MM-DD") that are QLD public
 * holidays in the given year. "Observed" rules apply: when a holiday falls
 * on a Saturday, it is observed on the Monday; on a Sunday, the Monday.
 */
function qldPublicHolidays(year: number): Set<string> {
  const holidays: Date[] = []

  /** Add a date with the weekend-observed rule. */
  function add(date: Date) {
    const dow = date.getUTCDay() // 0=Sun 6=Sat
    if (dow === 6) holidays.push(addDays(date, 2)) // Sat → Mon
    else if (dow === 0) holidays.push(addDays(date, 1)) // Sun → Mon
    else holidays.push(date)
  }

  /** Return the nth occurrence of a weekday in a given month (1-based). */
  function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
    // month is 1-based, weekday 0=Sun..6=Sat
    const first = new Date(Date.UTC(year, month - 1, 1))
    const firstDow = first.getUTCDay()
    let offset = (weekday - firstDow + 7) % 7
    offset += (n - 1) * 7
    return new Date(Date.UTC(year, month - 1, 1 + offset))
  }

  /** Return the last occurrence of a weekday in a given month. */
  function lastWeekday(year: number, month: number, weekday: number): Date {
    const last = new Date(Date.UTC(year, month, 0)) // last day of month
    const lastDow = last.getUTCDay()
    const offset = (lastDow - weekday + 7) % 7
    return new Date(Date.UTC(year, month - 1, last.getUTCDate() - offset))
  }

  // New Year's Day (1 Jan)
  add(new Date(Date.UTC(year, 0, 1)))

  // Australia Day (26 Jan)
  add(new Date(Date.UTC(year, 0, 26)))

  // Easter: Good Friday, Easter Saturday, Easter Monday
  const easter = easterSunday(year)
  holidays.push(addDays(easter, -2)) // Good Friday
  holidays.push(addDays(easter, -1)) // Easter Saturday (QLD specific)
  holidays.push(addDays(easter, 1))  // Easter Monday

  // Anzac Day (25 Apr) — only observed on Monday if it falls on a Sunday
  const anzac = new Date(Date.UTC(year, 3, 25))
  if (anzac.getUTCDay() === 0) holidays.push(addDays(anzac, 1))
  else holidays.push(anzac)

  // Labour Day: first Monday in May (QLD)
  holidays.push(nthWeekday(year, 5, 1, 1))

  // Royal Queensland Show (Ekka) — Brisbane area only; skip for our locations

  // King's Birthday: last Monday in October (QLD)
  holidays.push(lastWeekday(year, 10, 1))

  // Christmas Day (25 Dec) — may have two observed dates (25 + 26)
  const christmas = new Date(Date.UTC(year, 11, 25))
  const christmasDow = christmas.getUTCDay()
  if (christmasDow === 5) {
    // Friday Christmas → both 25 and 28 Dec (Boxing Day Mon)
    holidays.push(christmas)
    holidays.push(new Date(Date.UTC(year, 11, 28)))
  } else if (christmasDow === 6) {
    // Saturday Christmas → observed Mon 27, Boxing Day Tue 28
    holidays.push(new Date(Date.UTC(year, 11, 27)))
    holidays.push(new Date(Date.UTC(year, 11, 28)))
  } else if (christmasDow === 0) {
    // Sunday Christmas → observed Mon 26, Boxing Day Tue 27
    holidays.push(new Date(Date.UTC(year, 11, 26)))
    holidays.push(new Date(Date.UTC(year, 11, 27)))
  } else {
    holidays.push(christmas)
    // Boxing Day (26 Dec)
    add(new Date(Date.UTC(year, 11, 26)))
  }

  return new Set(holidays.map(dateKey))
}

// ─── Shift generation ─────────────────────────────────────────────────────────

interface ShiftTemplate {
  title: string
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
}

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { title: 'Pre-Open Shift',  startHour: 6,  startMinute: 0, endHour: 9,  endMinute: 0 },
  { title: 'Morning Shift',   startHour: 9,  startMinute: 0, endHour: 12, endMinute: 0 },
  { title: 'Afternoon Shift', startHour: 12, startMinute: 0, endHour: 17, endMinute: 0 },
]

const SHIFT_CAPACITY = 5
const WEEKS_AHEAD = 8

/**
 * Build a proper UTC Date from an AEST hour/minute.
 * AEST = UTC+10 (Queensland never observes daylight saving).
 * e.g. 9:00 AM AEST → 23:00 UTC the previous day.
 * Date.UTC handles negative hours correctly (rolls to previous day).
 */
function buildShiftTime(dateUTC: Date, aestHour: number, aestMinute: number): Date {
  return new Date(
    Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate(), aestHour - 10, aestMinute, 0, 0)
  )
}

export async function GET(request: NextRequest) {
  // Allow: Vercel cron (CRON_SECRET bearer token) OR a logged-in admin/super-admin
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!hasValidSecret) {
    // Fall back to session-based admin check
    const session = await getSession()
    const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
  }

  try {
    // Get all active locations
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    if (locations.length === 0) {
      return NextResponse.json({ message: 'No active locations found.', created: 0 })
    }

    // Determine date range: today (AEST naive) → 8 weeks ahead
    // We treat UTC dates as AEST naive (same convention as frontend)
    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + WEEKS_AHEAD * 7))

    // Pre-compute holidays for relevant years
    const holidaysByYear = new Map<number, Set<string>>()
    const startYear = todayUTC.getUTCFullYear()
    const endYear = endUTC.getUTCFullYear()
    for (let y = startYear; y <= endYear; y++) {
      holidaysByYear.set(y, qldPublicHolidays(y))
    }

    // Collect all dates in range that are Mon–Sat and not a public holiday
    const eligibleDates: Date[] = []
    let cursor = new Date(todayUTC)
    while (cursor <= endUTC) {
      const dow = cursor.getUTCDay() // 0=Sun, 1=Mon…6=Sat
      const year = cursor.getUTCFullYear()
      const key = dateKey(cursor)
      const holidays = holidaysByYear.get(year) ?? new Set<string>()

      if (dow >= 1 && dow <= 6 && !holidays.has(key)) {
        eligibleDates.push(new Date(cursor))
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    // Fetch existing shifts in range to avoid duplicates
    const existingShifts = await prisma.shift.findMany({
      where: {
        date: { gte: todayUTC, lte: endUTC },
        isActive: true,
      },
      select: {
        locationId: true,
        date: true,
        startTime: true,
      },
    })

    // Build a quick-lookup Set: "locationId|YYYY-MM-DD|HH:MM" (hours in AEST)
    // Convert stored UTC hours back to AEST (+10) for comparison against template hours.
    const existingKeys = new Set(
      existingShifts.map((s) => {
        const d = dateKey(s.date)
        const aestHour = (s.startTime.getUTCHours() + 10) % 24
        const h = String(aestHour).padStart(2, '0')
        const m = String(s.startTime.getUTCMinutes()).padStart(2, '0')
        return `${s.locationId}|${d}|${h}:${m}`
      })
    )

    // Generate missing shifts
    type ShiftRow = {
      date: Date
      startTime: Date
      endTime: Date
      locationId: string
      title: string
      capacity: number
      isRecurring: boolean
    }
    const shiftsToCreate: ShiftRow[] = []

    for (const day of eligibleDates) {
      for (const location of locations) {
        for (const tmpl of SHIFT_TEMPLATES) {
          const lookupKey = `${location.id}|${dateKey(day)}|${String(tmpl.startHour).padStart(2, '0')}:${String(tmpl.startMinute).padStart(2, '0')}`
          if (existingKeys.has(lookupKey)) continue

          shiftsToCreate.push({
            date: day,
            startTime: buildShiftTime(day, tmpl.startHour, tmpl.startMinute),
            endTime: buildShiftTime(day, tmpl.endHour, tmpl.endMinute),
            locationId: location.id,
            title: tmpl.title,
            capacity: SHIFT_CAPACITY,
            isRecurring: true,
          })
        }
      }
    }

    if (shiftsToCreate.length === 0) {
      return NextResponse.json({
        message: 'All shifts already exist — nothing to generate.',
        created: 0,
        locations: locations.length,
        eligibleDays: eligibleDates.length,
      })
    }

    // Batch-insert in chunks to avoid overwhelming the DB
    const CHUNK = 100
    let created = 0
    const createdShifts: { id: string; locationId: string; title: string | null; date: Date }[] = []

    for (let i = 0; i < shiftsToCreate.length; i += CHUNK) {
      const chunk = shiftsToCreate.slice(i, i + CHUNK)
      const result = await prisma.shift.createMany({ data: chunk, skipDuplicates: true })
      created += result.count
    }

    // ── Auto-book recurring preferences onto the newly created shifts ──────────
    let autoBooked = 0
    if (created > 0) {
      // Fetch the shifts we just created
      const newShifts = await prisma.shift.findMany({
        where: {
          date: { gte: todayUTC, lte: endUTC },
          isActive: true,
          isRecurring: true,
        },
        select: { id: true, locationId: true, title: true, date: true },
      })

      // Fetch all active recurring preferences
      const recurringPrefs = await prisma.recurringBooking.findMany({
        where: { isActive: true },
        select: {
          volunteerId: true,
          locationId: true,
          shiftTitle: true,
          dayOfWeek: true,
          anchorDate: true,
          frequency: true,
        },
      })

      if (recurringPrefs.length > 0) {
        // For each pref, find newly created shifts that match
        type AssignRow = { shiftId: string; volunteerId: string; status: 'SCHEDULED' }
        const toAssign: AssignRow[] = []

        for (const pref of recurringPrefs) {
          const matching = newShifts.filter(s =>
            s.locationId === pref.locationId &&
            s.title === pref.shiftTitle &&
            s.date.getUTCDay() === pref.dayOfWeek
          )
          for (const s of matching) {
            // Check cadence
            const anchorMs = Date.UTC(pref.anchorDate.getUTCFullYear(), pref.anchorDate.getUTCMonth(), pref.anchorDate.getUTCDate())
            const shiftMs  = Date.UTC(s.date.getUTCFullYear(), s.date.getUTCMonth(), s.date.getUTCDate())
            const diffDays = Math.round((shiftMs - anchorMs) / 86_400_000)
            if (diffDays < 0) continue
            let matches = false
            if (pref.frequency === 'WEEKLY')      matches = diffDays % 7  === 0
            if (pref.frequency === 'FORTNIGHTLY') matches = diffDays % 14 === 0
            if (pref.frequency === 'MONTHLY')     matches = diffDays % 28 === 0
            if (!matches) continue
            toAssign.push({ shiftId: s.id, volunteerId: pref.volunteerId, status: 'SCHEDULED' })
          }
        }

        if (toAssign.length > 0) {
          const result = await prisma.shiftAssignment.createMany({
            data: toAssign,
            skipDuplicates: true,
          })
          autoBooked = result.count
        }
      }
    }
    // ── End auto-book ──────────────────────────────────────────────────────────

    return NextResponse.json({
      message: `Generated ${created} new shift${created === 1 ? '' : 's'}${autoBooked > 0 ? `, auto-booked ${autoBooked} recurring assignment${autoBooked === 1 ? '' : 's'}` : ''}.`,
      created,
      autoBooked,
      locations: locations.length,
      eligibleDays: eligibleDates.length,
      weeksAhead: WEEKS_AHEAD,
    })
  } catch (err) {
    console.error('[GET /api/cron/generate-shifts]', err)
    return NextResponse.json({ error: 'Failed to generate shifts.' }, { status: 500 })
  }
}
