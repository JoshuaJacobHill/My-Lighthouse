export const APP_NAME = 'Lighthouse Care Volunteers'
export const ORG_NAME = 'Lighthouse Care'

export const LOCATIONS = [
  'Loganholme',
  'Hillcrest',
] as const

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export const TIME_PERIODS = [
  'Morning (6am–12pm)',
  'Afternoon (12pm–5pm)',
  'Evening (5pm–9pm)',
] as const

export const VOLUNTEER_STATUSES = {
  PENDING_INDUCTION: 'Pending Induction',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
  SUSPENDED: 'Suspended',
  REMOVED: 'Removed',
} as const

// Legacy statuses — no longer assignable but may exist in DB
export const LEGACY_VOLUNTEER_STATUSES: Record<string, string> = {
  INDUCTED: 'Inducted (legacy)',
  PAUSED: 'Paused (legacy)',
}

export const SHIFT_ASSIGNMENT_STATUSES = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED_BY_VOLUNTEER: 'Cancelled by Volunteer',
  ATTENDED: 'Attended',
  NO_SHOW: 'No Show',
  ADMIN_CANCELLED: 'Admin Cancelled',
} as const

export const BLUE_CARD_STATUSES = {
  NOT_APPLICABLE: 'Not Applicable',
  PENDING: 'Pending',
  CURRENT: 'Current',
  EXPIRED: 'Expired',
} as const

export const USER_ROLES = {
  VOLUNTEER: 'Volunteer',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  KIOSK: 'Kiosk',
} as const

export const AUSTRALIAN_STATES = [
  'QLD',
  'NSW',
  'VIC',
  'SA',
  'WA',
  'TAS',
  'NT',
  'ACT',
] as const

export type Location = (typeof LOCATIONS)[number]
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]
export type TimePeriod = (typeof TIME_PERIODS)[number]
export type VolunteerStatusKey = keyof typeof VOLUNTEER_STATUSES
export type ShiftAssignmentStatusKey = keyof typeof SHIFT_ASSIGNMENT_STATUSES
