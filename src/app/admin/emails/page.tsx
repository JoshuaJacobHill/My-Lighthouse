import * as React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Mail, Send, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { EmailTemplateToggle } from './EmailTemplateToggle'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Email Templates | Lighthouse Care Admin' }

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

// Which templates belong to the Donors tab (everything else is a Volunteer email).
const DONOR_TYPES = new Set([
  'DONATION_RECEIPT',
  'DONOR_ACCOUNT_SETUP',
  'TICKET_CONFIRMATION',
  'DONOR_MIGRATION',
])

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await getSession()
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/login')
  }

  const { tab: tabParam } = await searchParams
  const tab: 'volunteers' | 'donors' = tabParam === 'donors' ? 'donors' : 'volunteers'

  const templates = await prisma.emailTemplate.findMany({
    orderBy: { type: 'asc' },
  })

  // Build a map for quick lookup
  const templateMap = new Map(templates.map((t) => [t.type, t]))

  // Show the types for the active tab, using the DB template if available.
  const allTypes = Object.keys(TEMPLATE_NAMES).filter((t) =>
    tab === 'donors' ? DONOR_TYPES.has(t) : !DONOR_TYPES.has(t)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage automated email templates and send one-off messages.
          </p>
        </div>
        <Link
          href="/admin/emails/send"
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors whitespace-nowrap"
        >
          <Send className="h-4 w-4" />
          Send Email
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
        {(['volunteers', 'donors'] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/emails?tab=${t}`}
            className={
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ' +
              (tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')
            }
          >
            {t}
          </Link>
        ))}
      </div>

      {/* Templates list */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <div className="col-span-3">Template</div>
            <div className="col-span-5 hidden sm:block">Subject</div>
            <div className="col-span-2 text-center">Active</div>
            <div className="col-span-2 text-right">Edit</div>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {allTypes.map((type) => {
            const template = templateMap.get(type as never)
            const name = TEMPLATE_NAMES[type] ?? type
            const isActive = template?.isActive ?? true
            const subject = template?.subject ?? '(using default template)'

            return (
              <div
                key={type}
                className="grid grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isActive ? 'bg-orange-100 text-orange-500' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{name}</div>
                      <div className="text-xs text-gray-400">{type}</div>
                    </div>
                  </div>
                </div>

                <div className="col-span-5 hidden sm:block">
                  <p className="text-sm text-gray-500 truncate" title={subject}>
                    {subject}
                  </p>
                </div>

                <div className="col-span-2 flex justify-center">
                  {template ? (
                    <EmailTemplateToggle
                      templateId={template.id}
                      isActive={isActive}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">Default</span>
                  )}
                </div>

                <div className="col-span-2 flex justify-end">
                  <Link
                    href={`/admin/emails/${type}`}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-orange-100 bg-orange-50 px-5 py-4 text-sm text-orange-600">
        <strong>Tip:</strong> Templates that haven&apos;t been customised yet use the built-in default
        content. Click <em>Edit</em> on any template to customise it and save it to the database.
      </div>
    </div>
  )
}
