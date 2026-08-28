import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, User, AlertCircle } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/volunteer/StatusBadge'
import { type AvailabilityPeriodMap, type DayOfWeek, type AvailabilityPeriodKey } from '@/components/volunteer/AvailabilityCheckboxGrid'
import { AdminAvailabilityEditor } from '@/components/admin/AdminAvailabilityEditor'
import { AdminShiftsTab } from '@/components/admin/AdminShiftsTab'
import { AdminAttendanceTab } from '@/components/admin/AdminAttendanceTab'
import { VolunteerTabs } from '@/components/admin/VolunteerTabs'
import { ChangeStatusModal } from '@/components/admin/ChangeStatusModal'
import { AddNoteModal } from '@/components/admin/AddNoteModal'
import { SendEmailModal } from '@/components/admin/SendEmailModal'
import { OnboardingForm } from '@/components/admin/OnboardingForm'
import { DeleteVolunteerButton } from '@/components/admin/DeleteVolunteerButton'
import { formatDate, formatDateTime } from '@/lib/utils'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function VolunteerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireCapability('care.people')
  const { id } = await params

  const volunteer = await prisma.volunteerProfile.findUnique({
    where: { id },
    include: {
      user: true,
      availability: { orderBy: { startTime: 'asc' } },
      inductionProgress: { include: { section: true } },
      shiftAssignments: {
        include: { shift: { include: { location: true, department: true } } },
        orderBy: { shift: { date: 'desc' } },
        take: 20,
      },
      attendanceRecords: {
        include: { location: true },
        orderBy: { signInAt: 'desc' },
        take: 20,
      },
      adminNotes: {
        include: { createdBy: true },
        orderBy: { createdAt: 'desc' },
      },
      emailLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      quizAnswers: true,
    },
  })

  if (!volunteer) notFound()

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  const fullName = `${volunteer.firstName} ${volunteer.lastName}`

  // Build availability period map from DB records
  const availabilityPeriods: AvailabilityPeriodMap = {}
  for (const a of volunteer.availability) {
    const day = a.dayOfWeek as DayOfWeek
    const period = a.timePeriod as AvailabilityPeriodKey
    if (!['PRE_OPEN', 'MORNING', 'AFTERNOON'].includes(period)) continue
    if (!availabilityPeriods[day]) availabilityPeriods[day] = []
    if (!availabilityPeriods[day]!.includes(period)) {
      availabilityPeriods[day]!.push(period)
    }
  }

  // Induction progress
  const totalSections = volunteer.inductionProgress.length
  const completedSections = volunteer.inductionProgress.filter((p) => p.completed).length

  // Total attendance hours
  const totalMins = volunteer.attendanceRecords.reduce(
    (sum, r) => sum + (r.durationMins ?? 0),
    0
  )

  // ─── Tab content ─────────────────────────────────────────────────────────────

  const detailsTab = (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Contact
        </h3>
        <InfoRow label="Email" value={volunteer.email} />
        <InfoRow label="Mobile" value={volunteer.mobile} />
        <InfoRow
          label="Date of Birth"
          value={volunteer.dateOfBirth ? formatDate(volunteer.dateOfBirth) : undefined}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Address
        </h3>
        <InfoRow label="Street" value={volunteer.addressLine1} />
        {volunteer.addressLine2 && <InfoRow label="" value={volunteer.addressLine2} />}
        <InfoRow
          label="Suburb"
          value={[volunteer.suburb, volunteer.state, volunteer.postcode]
            .filter(Boolean)
            .join(' ') || undefined}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Emergency Contact
        </h3>
        <InfoRow label="Name" value={volunteer.emergencyName} />
        <InfoRow label="Phone" value={volunteer.emergencyPhone} />
        <InfoRow label="Relationship" value={volunteer.emergencyRelation} />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Blue Card
        </h3>
        <InfoRow label="Blue Card Status" value={volunteer.blueCardStatus} />
        {volunteer.blueCardNumber && (
          <InfoRow label="Blue Card Number" value={volunteer.blueCardNumber} />
        )}
        {volunteer.blueCardExpiry && (
          <InfoRow
            label="Blue Card Expiry"
            value={formatDate(volunteer.blueCardExpiry)}
          />
        )}
        {volunteer.preferredLocations.length > 0 && (
          <InfoRow
            label="Preferred Store"
            value={volunteer.preferredLocations.join(', ')}
          />
        )}
      </section>

      {(volunteer.medicalNotes || volunteer.accessibilityNeeds || volunteer.notes) && (
        <section className="sm:col-span-2 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Additional Notes
          </h3>
          {volunteer.medicalNotes && (
            <InfoRow label="Medical" value={volunteer.medicalNotes} />
          )}
          {volunteer.accessibilityNeeds && (
            <InfoRow label="Accessibility" value={volunteer.accessibilityNeeds} />
          )}
          {volunteer.notes && <InfoRow label="Notes" value={volunteer.notes} />}
        </section>
      )}
    </div>
  )

  const availabilityTab = (
    <AdminAvailabilityEditor
      volunteerId={volunteer.id}
      initialAvailability={availabilityPeriods}
    />
  )

  const serialisedAssignments = volunteer.shiftAssignments.map((a) => ({
    id: a.id,
    status: a.status,
    shift: {
      date: a.shift.date.toISOString(),
      startTime: a.shift.startTime.toISOString(),
      endTime: a.shift.endTime.toISOString(),
      location: { name: a.shift.location.name },
      department: a.shift.department ? { name: a.shift.department.name } : null,
    },
  }))

  const shiftsTab = (
    <AdminShiftsTab
      volunteerId={volunteer.id}
      initialAssignments={serialisedAssignments}
      locations={locations}
    />
  )

  const attendanceTab = (
    <AdminAttendanceTab
      volunteerId={volunteer.id}
      totalMins={totalMins}
      locations={locations}
      initialRecords={volunteer.attendanceRecords.map((r) => ({
        id: r.id,
        signInAt: r.signInAt.toISOString(),
        signOutAt: r.signOutAt?.toISOString() ?? null,
        durationMins: r.durationMins,
        location: r.location ? { id: r.location.id, name: r.location.name } : null,
      }))}
    />
  )

  const notesTab = (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AddNoteModal volunteerId={volunteer.id} triggerLabel="Add Note" />
      </div>
      {volunteer.adminNotes.length === 0 ? (
        <EmptyState message="No notes recorded yet." />
      ) : (
        <div className="space-y-3">
          {volunteer.adminNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <span className="text-xs font-medium text-gray-500">
                  {note.createdBy.name ?? note.createdBy.email} &mdash;{' '}
                  {formatDateTime(note.createdAt)}
                </span>
                {note.isInternal && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    Internal
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // Parse inductionAnswers from JSON field
  const inductionAnswers = (volunteer.inductionAnswers && typeof volunteer.inductionAnswers === 'object' && !Array.isArray(volunteer.inductionAnswers))
    ? volunteer.inductionAnswers as Record<string, string>
    : {}

  const onboardingTab = (
    <OnboardingForm
      volunteerId={volunteer.id}
      initialAnswers={inductionAnswers}
    />
  )

  const emailsTab = (
    volunteer.emailLogs.length === 0 ? (
      <EmptyState message="No emails have been sent to this volunteer." />
    ) : (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Template</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {volunteer.emailLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-3 text-gray-900">{log.subject}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <EmailStatusBadge status={log.status} />
                </td>
                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                  {log.templateType ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  )

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/volunteers"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Volunteers
      </Link>

      {/* Profile header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar
            name={fullName}
            src={volunteer.avatarUrl ?? undefined}
            size="xl"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
              <StatusBadge status={volunteer.status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Joined {formatDate(volunteer.joinedAt)}
              {volunteer.lastAttendedAt && (
                <> &middot; Last attended {formatDate(volunteer.lastAttendedAt)}</>
              )}
            </p>

            {/* Quick info row */}
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-gray-400" aria-hidden="true" />
                {volunteer.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-gray-400" aria-hidden="true" />
                {volunteer.mobile}
              </span>
              {volunteer.suburb && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {volunteer.suburb}
                </span>
              )}
            </div>

            {/* Induction progress */}
            {totalSections > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Induction progress</span>
                  <span>{completedSections} of {totalSections} sections complete</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-orange-500 transition-all"
                    style={{ width: `${Math.round((completedSections / totalSections) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/volunteers/${volunteer.id}/edit`}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Edit Profile
            </Link>
            <ChangeStatusModal
              volunteerId={volunteer.id}
              currentStatus={volunteer.status}
            />
            <SendEmailModal volunteerId={volunteer.id} volunteerName={fullName} />
            <AddNoteModal volunteerId={volunteer.id} />
            <DeleteVolunteerButton
              volunteerId={volunteer.id}
              volunteerName={fullName}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <VolunteerTabs
          tabs={[
            { id: 'details', label: 'Details', content: detailsTab },
            { id: 'availability', label: 'Availability', content: availabilityTab },
            { id: 'shifts', label: 'Shifts', content: shiftsTab },
            { id: 'attendance', label: 'Attendance', content: attendanceTab },
            { id: 'notes', label: `Notes (${volunteer.adminNotes.length})`, content: notesTab },
            { id: 'emails', label: 'Emails', content: emailsTab },
            { id: 'onboarding', label: 'Onboarding', content: onboardingTab },
          ]}
        />
      </div>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      {label && (
        <span className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      )}
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}


function EmailStatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SENT: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    BOUNCED: 'bg-orange-100 text-orange-800',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${colours[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}
