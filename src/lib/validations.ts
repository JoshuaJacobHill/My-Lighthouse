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
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

export const volunteerSignupSchema = z.object({
  // Personal details
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Please enter a valid email address'),
  mobile: z
    .string()
    .min(10, 'Please enter a valid Australian phone number')
    .max(15)
    .regex(/^(\+61|0)[234578]\d{8}$/, 'Please enter a valid Australian phone number (mobile or landline)'),
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
    .min(10, 'Please enter a valid Australian phone number')
    .max(15)
    .regex(/^(\+61|0)[234578]\d{8}$/, 'Please enter a valid Australian phone number (mobile or landline)'),
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

// ─── Fund / designation (donor portal) ──────────────────────────────────────

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

export const fundSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Fund name is required')
    .max(120, 'Fund name is too long (max 120 characters)'),
  // Optional — generated from the name when left blank. Lowercase, hyphenated.
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only')
    .optional()
    .or(z.literal('')),
  description: optionalTrimmed,
  // Money comes off a number input as a string; keep it optional.
  goalAmount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: 'Goal must be a positive amount',
    }),
  startsAt: optionalTrimmed,
  endsAt: optionalTrimmed,
  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 0 : Number(v)))
    .refine((v) => Number.isInteger(v), { message: 'Sort order must be a whole number' }),
  isActive: z.boolean().optional().default(true),
  showPublicProgress: z.boolean().optional().default(false),
  // Appeal (donor dashboard) fields.
  imageUrl: optionalTrimmed,
  tagline: optionalTrimmed,
  showOnDashboard: z.boolean().optional().default(false),
  // Which Stripe account this fund's gifts deposit to.
  depositAccount: z.enum(['CARE', 'CHURCH']).optional().default('CARE'),
  // Per-fund giving amounts (comma list from the form → sorted unique ints).
  presetAmounts: z
    .union([z.string(), z.array(z.number())])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return [] as number[]
      const arr = Array.isArray(v) ? v : String(v).split(',')
      const nums = arr
        .map((x) => Math.round(Number(String(x).replace(/[^0-9.]/g, ''))))
        .filter((n) => Number.isFinite(n) && n > 0)
      return [...new Set(nums)].sort((a, b) => a - b)
    }),
  suggestedAmount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Math.round(Number(v))))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
      message: 'Suggested amount must be positive',
    }),
  impactLabels: z
    .union([z.string(), z.record(z.string(), z.string())])
    .optional()
    .transform((v) => {
      if (!v) return undefined
      if (typeof v !== 'string') return v
      const map: Record<string, string> = {}
      for (const line of v.split('\n')) {
        const m = /^\s*\$?\s*(\d+)\s*[:=]\s*(.+?)\s*$/.exec(line)
        if (m) map[m[1]] = m[2].trim()
      }
      return Object.keys(map).length ? map : undefined
    }),
  defaultFrequency: z
    .string()
    .optional()
    .transform((v) => (['once', 'weekly', 'fortnightly', 'monthly'].includes(v ?? '') ? v : undefined)),
})

// Input type (pre-transform): forms send strings for numbers/dates.
export type FundInput = z.input<typeof fundSchema>

// ─── Stories / Good News (donor dashboard content) ───────────────────────────

export const storySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160, 'Title is too long'),
  slug: z
    .string()
    .trim()
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only')
    .optional()
    .or(z.literal('')),
  category: z.string().trim().max(40).optional().default('Good news'),
  excerpt: optionalTrimmed,
  imageUrl: optionalTrimmed,
  externalUrl: optionalTrimmed,
  isPublished: z.boolean().optional().default(false),
  churchOnly: z.boolean().optional().default(false),
  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 0 : Number(v)))
    .refine((v) => Number.isInteger(v), { message: 'Sort order must be a whole number' }),
})
export type StoryInput = z.input<typeof storySchema>

// ─── Events & ticketing (donor portal) ───────────────────────────────────────

const optInt = (msg: string, min: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min), { message: msg })

const ticketTypeInputSchema = z.object({
  id: z.string().optional(), // present when editing an existing type
  name: z.string().trim().min(1, 'Ticket name is required').max(100),
  // 0 = free / RSVP ticket.
  price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 0 : Number(v)))
    .refine((v) => Number.isFinite(v) && v >= 0, { message: 'Price must be $0 or more' }),
  quantityAvailable: optInt('Quantity must be a whole number', 0), // null = unlimited
  maxPerOrder: optInt('Max per order must be at least 1', 1), // null = no limit
})

export const eventSchema = z.object({
  churchOnly: z.boolean().optional().default(false),
  title: z.string().trim().min(1, 'Event title is required').max(200),
  slug: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only')
    .optional()
    .or(z.literal('')),
  description: z.string().trim().min(1, 'Please add a description'),
  imageUrl: optionalTrimmed,
  venue: optionalTrimmed,
  startsAt: optionalTrimmed, // blank = date To Be Advised
  endsAt: optionalTrimmed,
  capacity: optInt('Capacity must be at least 1', 1), // null = unlimited
  fundId: optionalTrimmed,
  isPublished: z.boolean().optional().default(false),
  allowVolunteers: z.boolean().optional().default(false),
  volunteerCapacity: optInt('Capacity must be at least 1', 1),
  allowDonations: z.boolean().optional().default(false),
  allowSponsors: z.boolean().optional().default(false),
  ticketTypes: z.array(ticketTypeInputSchema).min(1, 'Add at least one ticket type'),
})

export type EventInput = z.input<typeof eventSchema>
export type TicketTypeInput = z.input<typeof ticketTypeInputSchema>

// ─── Fundraisers (donor portal) ───────────────────────────────────────────────

export const fundraiserSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  slug: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only')
    .optional()
    .or(z.literal('')),
  story: z.string().trim().min(1, 'Please add the fundraiser story'),
  imageUrl: optionalTrimmed,
  goalAmount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), { message: 'Goal must be $0 or more' }),
  organiserName: z.string().trim().min(1, 'Organiser name is required').max(200),
  organiserEmail: z.union([z.literal(''), z.email('Please enter a valid email address')]).optional(),
  fundId: z.string().min(1, 'Choose which fund the proceeds go to'),
  isActive: z.boolean().optional().default(true),
})

export type FundraiserInput = z.input<typeof fundraiserSchema>

export const offlineDonationSchema = z.object({
  fundraiserId: z.string().min(1),
  donorName: z.string().trim().max(200).optional(), // business name; blank = Anonymous
  amount: z.coerce.number().min(0.01, 'Amount must be greater than $0').max(1_000_000),
  donatedAt: optionalTrimmed, // yyyy-mm-dd; defaults to now
  message: z.string().trim().max(250).optional(), // optional public message
})

export type OfflineDonationInput = z.input<typeof offlineDonationSchema>

// Editing an existing offline gift — same fields, minus the fundraiser link.
export const offlineDonationEditSchema = offlineDonationSchema.omit({ fundraiserId: true })
export type OfflineDonationEditInput = z.input<typeof offlineDonationEditSchema>

export type AdminNoteInput = z.infer<typeof adminNoteSchema>
