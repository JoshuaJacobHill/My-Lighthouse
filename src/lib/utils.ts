import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

// ─── Styling ──────────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function toDate(date: Date | string): Date {
  if (typeof date === 'string') {
    return parseISO(date)
  }
  return date
}

/**
 * Format a date in Australian format. Default: dd/MM/yyyy
 */
export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  try {
    return format(toDate(date), fmt)
  } catch {
    return ''
  }
}

/**
 * Format a date and time in Australian format. e.g. 25/12/2024 9:30 am
 */
export function formatDateTime(date: Date | string): string {
  try {
    return format(toDate(date), 'dd/MM/yyyy h:mm aa')
  } catch {
    return ''
  }
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
