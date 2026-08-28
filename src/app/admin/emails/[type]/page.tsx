import * as React from 'react'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { defaultTemplates } from '@/lib/email-templates'
import { TemplateEditor } from './TemplateEditor'
import type { EmailTemplateType } from '@prisma/client'
import { isAdminRole } from '@/lib/permissions-core'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Edit Email Template | Lighthouse Care Admin' }

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
  DONATION_RECEIPT: 'Donation Receipt / Thank-You',
  DONOR_ACCOUNT_SETUP: 'Donor Account Setup',
  TICKET_CONFIRMATION: 'Event Ticket Confirmation',
  DONOR_MIGRATION: 'Donor Migration (Re-confirm Card)',
  CUSTOM: 'Custom / One-Off',
}

const VALID_TYPES = Object.keys(TEMPLATE_NAMES)

interface PageProps {
  params: Promise<{ type: string }>
}

export default async function EditTemplatePage({ params }: PageProps) {
  await requireCapability('system.settings')
  const session = await getSession()
  if (!session || !isAdminRole(session.role)) {
    redirect('/login')
  }

  const { type } = await params

  if (!VALID_TYPES.includes(type)) {
    notFound()
  }

  // Try to load from DB, fall back to defaults
  const dbTemplate = await prisma.emailTemplate.findUnique({
    where: { type: type as EmailTemplateType },
  })

  const defaults = defaultTemplates[type as EmailTemplateType] ?? {
    subject: '',
    html: '',
    text: '',
  }

  const template = {
    id: dbTemplate?.id ?? null,
    type,
    name: TEMPLATE_NAMES[type] ?? type,
    subject: dbTemplate?.subject ?? defaults.subject,
    bodyHtml: dbTemplate?.bodyHtml ?? defaults.html,
    bodyText: dbTemplate?.bodyText ?? defaults.text ?? '',
    isActive: dbTemplate?.isActive ?? true,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <a href="/admin/emails" className="hover:text-orange-500 transition-colors">
            Email Templates
          </a>
          <span>/</span>
          <span className="text-gray-700">{template.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {dbTemplate
            ? 'Editing customised template'
            : 'Using default template — save to customise'}
        </p>
      </div>

      <TemplateEditor template={template} />
    </div>
  )
}
