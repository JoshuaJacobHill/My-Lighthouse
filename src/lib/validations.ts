import { z } from 'zod'
import { DAYS_OF_WEEK, LOCATIONS } from '@/lib/constants'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

// Spread readonly tuples into mutable tuples for zod enum
const DAYS_ENUM = [...DAYS_OF_WEEK] as [string, ...string[]]
const LOCATIONS_ENUM = [...LOCATIONS] as [string, ...string[]]

// ─── Volunteer signup ─────────────────────────────────────────────────────────

const availabilityItemSchema = z.object({
  dayOfWeek: z.enum(DAYS_ENUM),
  timePeriod: z.string().min(1),
})

export const volunteerSignupSchema = z.object({
  // Personal details
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Please enter a valid email address'),
  mobile: z
    .string()
    .min(10, 'Please enter a valid Australian mobile number')
    .max(15)
    .regex(/^(\+61|0)[4-5]\d{8}$/, 'Please enter a valid Australian mobile number'),
  dateOfBirth: z.string().optional(),

  // Address
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z
    .string()
    .regex(/^\d{4}$/, 'Postcode must be 4 digits')
    .optional()
    .or(z.literal('')),

  // Emergency contact
  emergencyName: z.string().min(1, 'Emergency contact name is required'),
  emergencyPhone: z.string().min(10, 'Emergency contact phone is required'),
  emergencyRelation: z.string().optional(),

  // Preferred store (for email routing)
  preferredStore: z.enum(LOCATIONS_ENUM).optional(),

  // Preferences (kept for DB compatibility but no longer collected in form)
  preferredLocations: z.array(z.string()).optional().default([]),
  areasOfInterest: z.array(z.string()).optional().default([]),
  availability: z.array(availabilityItemSchema).optional().default([]),

  // Medical / accessibility
  medicalNotes: z.string().optional(),
  accessibilityNeeds: z.string().optional(),

  // Account
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),

  // Consents
  agreedToTerms: z.boolean().refine((v) => v === true, {
    message: 'You must agree to the terms and conditions',
  }),
  agreedToPrivacy: z.boolean().refine((v) => v === true, {
    message: 'You must agree to the privacy policy',
  }),
  consentEmailUpdates: z.boolean().optional().default(false),
  consentSmsUpdates: z.boolean().optional().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type VolunteerSignupInput = z.infer<typeof volunteerSignupSchema>

// ─── Profile update (volunteer self-serve) ────────────────────────────────────

export const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  mobile: z
    .string()
    .min(10, 'Please enter a valid Australian mobile number')
    .max(15)
    .regex(/^(\+61|0)[4-5]\d{8}$/, 'Please enter a valid Australian mobile number'),
  dateOfBirth: z.string().optional(),

  // Address
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z
    .string()
    .regex(/^\d{4}$/, 'Postcode must be 4 digits')
    .optional()
    .or(z.literal('')),

  // Emergency contact
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),

  // Medical / accessibility
  medicalNotes: z.string().optional(),
  accessibilityNeeds: z.string().optional(),

  // Consents
  consentEmailUpdates: z.boolean().optional(),
  consentSmsUpdates: z.boolean().optional(),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

// ─── Shift ────────────────────────────────────────────────────────────────────

export const shiftSchema = z.object({
  locationId: z.string().min(1, 'Location is required'),
  departmentId: z.string().optional(),
  title: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').default(1),
  isRecurring: z.boolean().optional().default(false),
  notes: z.string().optional(),
})

export type ShiftInput = z.infer<typeof shiftSchema>

// ─── Admin note ───────────────────────────────────────────────────────────────

export const adminNoteSchema = z.object({
  content: z
    .string()
    .min(1, 'Note content is required')
    .max(5000, 'Note is too long (max 5000 characters)'),
  isInternal: z.boolean().optional().default(true),
})

export type AdminNoteInput = z.infer<typeof adminNoteSchema>
