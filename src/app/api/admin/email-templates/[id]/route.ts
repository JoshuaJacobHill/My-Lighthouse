import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { EmailTemplateType } from '@prisma/client'

async function requireAdmin() {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return null
  }
  return session
}

const VALID_TYPES = [
  'SIGNUP_CONFIRMATION',
  'INDUCTION_REMINDER',
  'INDUCTION_COMPLETE',
  'SHIFT_BOOKED',
  'VOLUNTEER_WELCOME',
  'SHIFT_REMINDER',
  'SHIFT_CANCELLED',
  'MISSED_SHIFT_FOLLOWUP',
  'INACTIVITY_CHECKIN',
  'ADMIN_NEW_VOLUNTEER',
  'ADMIN_REPEATED_NOSHOWS',
  'CUSTOM',
]

const TEMPLATE_NAMES: Record<string, string> = {
  SIGNUP_CONFIRMATION: 'Sign-Up Confirmation',
  INDUCTION_REMINDER: 'Induction Reminder',
  INDUCTION_COMPLETE: 'Induction Complete',
  SHIFT_BOOKED: 'Shift Booking Confirmation',
  VOLUNTEER_WELCOME: 'Volunteer Welcome (Import)',
  SHIFT_REMINDER: 'Shift Reminder',
  SHIFT_CANCELLED: 'Shift Cancelled',
  MISSED_SHIFT_FOLLOWUP: 'Missed Shift Follow-Up',
  INACTIVITY_CHECKIN: 'Inactivity Check-In',
  ADMIN_NEW_VOLUNTEER: 'Admin: New Volunteer',
  ADMIN_REPEATED_NOSHOWS: 'Admin: Repeated No-Shows',
  CUSTOM: 'Custom / One-Off',
}

// PATCH — toggle isActive (called from toggle button with templateId)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  try {
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.subject !== undefined && { subject: body.subject }),
        ...(body.bodyHtml !== undefined && { bodyHtml: body.bodyHtml }),
        ...(body.bodyText !== undefined && { bodyText: body.bodyText }),
      },
    })
    return NextResponse.json({ success: true, template: updated })
  } catch (err) {
    console.error('[PATCH email-templates/[id]]', err)
    return NextResponse.json({ success: false, error: 'Update failed.' }, { status: 500 })
  }
}

// PUT — upsert full template by type (called from TemplateEditor with type as id)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const { id: type } = await params

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ success: false, error: 'Invalid template type.' }, { status: 400 })
  }

  const body = await request.json()
  const { subject, bodyHtml, bodyText } = body

  if (!subject || !bodyHtml) {
    return NextResponse.json(
      { success: false, error: 'Subject and HTML body are required.' },
      { status: 400 }
    )
  }

  try {
    const template = await prisma.emailTemplate.upsert({
      where: { type: type as EmailTemplateType },
      update: { subject, bodyHtml, bodyText: bodyText ?? null, updatedAt: new Date() },
      create: {
        type: type as EmailTemplateType,
        name: TEMPLATE_NAMES[type] ?? type,
        subject,
        bodyHtml,
        bodyText: bodyText ?? null,
        isActive: true,
      },
    })
    return NextResponse.json({ success: true, template })
  } catch (err) {
    console.error('[PUT email-templates/[id]]', err)
    return NextResponse.json({ success: false, error: 'Save failed.' }, { status: 500 })
  }
}
