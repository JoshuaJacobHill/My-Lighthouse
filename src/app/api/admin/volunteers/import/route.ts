import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { getSession, hashPassword } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportRow {
  first_name: string
  last_name: string
  email: string
  mobile: string
  date_of_birth?: string
  address_line1?: string
  address_line2?: string
  suburb?: string
  state?: string
  postcode?: string
  emergency_name?: string
  emergency_phone?: string
  emergency_relation?: string
  preferred_locations?: string   // comma-separated e.g. "Loganholme,Hillcrest"
  areas_of_interest?: string     // comma-separated
  status?: string
  medical_notes?: string
  accessibility_needs?: string
  notes?: string
}

export interface ImportResult {
  row: number
  name: string
  email: string
  status: 'imported' | 'skipped' | 'error'
  tempPassword?: string
  reason?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  // e.g. "Lc4mR9aB" — readable enough to share verbally or in email
  return crypto.randomBytes(6).toString('base64url').slice(0, 8)
}

const VALID_STATUSES = new Set([
  'PENDING_INDUCTION',
  'ACTIVE',
  'INACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'REMOVED',
])

function normaliseStatus(raw?: string): 'PENDING_INDUCTION' | string {
  if (!raw) return 'PENDING_INDUCTION'
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_')
  return VALID_STATUSES.has(upper) ? upper : 'PENDING_INDUCTION'
}

function splitList(raw?: string): string[] {
  if (!raw) return []
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ─── POST /api/admin/volunteers/import ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let rows: ImportRow[]
  try {
    const body = await req.json()
    rows = body.rows
    if (!Array.isArray(rows)) throw new Error('rows must be an array')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const results: ImportResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1
    const name = `${(row.first_name ?? '').trim()} ${(row.last_name ?? '').trim()}`.trim()
    const email = (row.email ?? '').trim().toLowerCase()

    // Basic validation
    if (!row.first_name?.trim() || !row.last_name?.trim()) {
      results.push({ row: rowNum, name: name || '(unknown)', email, status: 'error', reason: 'First and last name are required' })
      continue
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ row: rowNum, name, email, status: 'error', reason: 'Invalid or missing email address' })
      continue
    }
    if (!row.mobile?.trim()) {
      results.push({ row: rowNum, name, email, status: 'error', reason: 'Mobile number is required' })
      continue
    }

    // Skip duplicates
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      results.push({ row: rowNum, name, email, status: 'skipped', reason: 'Email already registered' })
      continue
    }

    // Create user + profile
    try {
      const tempPassword = generateTempPassword()
      const passwordHash = await hashPassword(tempPassword)

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name,
            role: 'VOLUNTEER',
          },
        })

        await tx.volunteerProfile.create({
          data: {
            userId: user.id,
            firstName: row.first_name.trim(),
            lastName: row.last_name.trim(),
            email,
            mobile: row.mobile!.trim(),
            dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
            addressLine1: row.address_line1?.trim() || null,
            addressLine2: row.address_line2?.trim() || null,
            suburb: row.suburb?.trim() || null,
            state: row.state?.trim() || null,
            postcode: row.postcode?.trim() || null,
            emergencyName: row.emergency_name?.trim() || '',
            emergencyPhone: row.emergency_phone?.trim() || '',
            emergencyRelation: row.emergency_relation?.trim() || null,
            preferredLocations: splitList(row.preferred_locations),
            areasOfInterest: splitList(row.areas_of_interest),
            medicalNotes: row.medical_notes?.trim() || null,
            accessibilityNeeds: row.accessibility_needs?.trim() || null,
            notes: row.notes?.trim() || null,
            status: normaliseStatus(row.status) as never,
            agreedToTerms: false,
            agreedToPrivacy: false,
          },
        })
      })

      results.push({ row: rowNum, name, email, status: 'imported', tempPassword })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ row: rowNum, name, email, status: 'error', reason: msg })
    }
  }

  return NextResponse.json({ results })
}
