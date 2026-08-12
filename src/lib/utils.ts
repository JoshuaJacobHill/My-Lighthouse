import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

// ─── Styling ──────────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── Date formatting ──────────────────────────────────────────────────────────
//
// IMPORTANT: all dates/times are stored in UTC. We display them in Brisbane time
// (AEST, UTC+10, no daylight saving). These helpers MUST force the Brisbane
// timezone — date-fns `format()` renders in the runtime's local timezone, and on
// the server (Vercel) that is UTC, which made every server-rendered time show
// ~10 hours behind (e.g. a 1:30 pm sign-in appearing as 3:30 am).

const BRISBANE_TZ = 'Australia/Brisbane'

function toDate(date: Date | string): Date {
  if (typeof date === 'string') {
    return parseISO(date)
  }
  return date
}

/**
 * Format a date in Australian format (Brisbane time). Default: dd/MM/yyyy
 */
export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  try {
    const d = toDate(date)
    if (fmt === 'dd/MM/yyyy') {
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: BRISBANE_TZ,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d)
    }
    // Custom format string: shift the instant to the Brisbane wall clock
    // (+10h, no DST) and format, since date-fns has no timezone support here.
    return format(new Date(d.getTime() + 10 * 60 * 60 * 1000), fmt)
  } catch {
    return ''
  }
}

/**
 * Format a date and time in Australian format (Brisbane time).
 * e.g. 25/12/2024 9:30 am
 */
export function formatDateTime(date: Date | string): string {
  try {
    const d = toDate(date)
    const datePart = new Intl.DateTimeFormat('en-AU', {
      timeZone: BRISBANE_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
    const timePart = new Intl.DateTimeFormat('en-AU', {
      timeZone: BRISBANE_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
    return `${datePart} ${timePart}`
  } catch {
    return ''
  }
}

/**
 * Format the time only in Australian format (Brisbane time). e.g. 9:00 am
 */
export function formatTime(date: Date | string): string {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: BRISBANE_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(toDate(date))
  } catch {
    return ''
  }
}

/**
 * Format an event's date/time, with an optional end. When both fall on the same
 * Brisbane day, shows one date with a time range (e.g. "16/08/2026 9:00 am – 11:15 am");
 * otherwise shows the full start and end. With no end, just the start.
 */
export function formatEventWhen(start: Date | string, end?: Date | string | null): string {
  if (!end) return formatDateTime(start)
  if (formatDate(start) === formatDate(end)) {
    return `${formatDateTime(start)} – ${formatTime(end)}`
  }
  return `${formatDateTime(start)} – ${formatDateTime(end)}`
}

// ─── Duration ─────────────────────────────────────────────────────────────────

/**
 * Format a duration in minutes to a human-readable string. e.g. "2h 30m"
 */
export function formatDuration(mins: number): string {
  if (mins <= 0) return '0m'
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

// ─── Names ────────────────────────────────────────────────────────────────────

/**
 * Get initials from a first and last name. e.g. "John Smith" → "JS"
 */
export function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim().charAt(0).toUpperCase()
  const l = lastName.trim().charAt(0).toUpperCase()
  return `${f}${l}`
}

// ─── Volunteer status ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING_INDUCTION: 'Pending Induction',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
  SUSPENDED: 'Suspended',
  REMOVED: 'Removed',
  // legacy
  INDUCTED: 'Inducted',
  PAUSED: 'On Leave',
}

/**
 * Convert a VolunteerStatus enum value to a human-readable label.
 */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

const STATUS_COLOURS: Record<string, string> = {
  PENDING_INDUCTION: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
  ON_LEAVE: 'bg-blue-100 text-blue-700',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  REMOVED: 'bg-red-100 text-red-800',
  // legacy
  INDUCTED: 'bg-green-100 text-green-800',
  PAUSED: 'bg-blue-100 text-blue-700',
}

/**
 * Return a Tailwind CSS class string for a volunteer status badge.
 */
export function statusColour(status: string): string {
  return STATUS_COLOURS[status] ?? 'bg-gray-100 text-gray-600'
}

// ─── Availability time period config ─────────────────────────────────────────

import type { TimePeriod } from '@/components/volunteer/AvailabilityGrid'

export interface TimePeriodConfig {
  key: TimePeriod
  label: string
  hours: string
}

/**
 * Build the timePeriods array from AppSetting records, falling back to defaults.
 * Pass in a plain Record<string, string> of all availability_ settings.
 */
export function getTimePeriodConfig(settings: Record<string, string>): TimePeriodConfig[] {
  return [
    {
      key: 'MORNING' as const,
      label: settings.availability_morning_label ?? 'Morning',
      hours: settings.availability_morning_hours ?? '9 am – 12 pm',
    },
    {
      key: 'AFTERNOON' as const,
      label: settings.availability_afternoon_label ?? 'Afternoon',
      hours: settings.availability_afternoon_hours ?? '12 pm – 5 pm',
    },
    {
      key: 'EVENING' as const,
      label: settings.availability_evening_label ?? 'Evening',
      hours: settings.availability_evening_hours ?? '5 pm – 9 pm',
    },
  ]
}
