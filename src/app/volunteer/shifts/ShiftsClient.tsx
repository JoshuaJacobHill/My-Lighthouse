'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { notifyCannotAttendAction } from '@/lib/actions/volunteer.actions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
} from '@/components/ui/modal'
import { Calendar, Loader2 } from 'lucide-react'

const SHIFT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED_BY_VOLUNTEER: 'Cancelled by me',
  ATTENDED: 'Attended',
  NO_SHOW: 'No show',
  ADMIN_CANCELLED: 'Cancelled',
}

const SHIFT_STATUS_COLOURS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 border border-blue-200',
  CONFIRMED: 'bg-green-100 text-green-800 border border-green-200',
  CANCELLED_BY_VOLUNTEER: 'bg-gray-100 text-gray-600 border border-gray-200',
  ATTENDED: 'bg-orange-100 text-orange-700 border border-orange-200',
  NO_SHOW: 'bg-red-100 text-red-800 border border-red-200',
  ADMIN_CANCELLED: 'bg-gray-100 text-gray-600 border border-gray-200',
}

const BRISBANE_TZ = 'Australia/Brisbane'

function formatAustralianDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: BRISBANE_TZ,
  })
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: BRISBANE_TZ,
  })
}

interface ShiftData {
  id: string
  status: string
  cancelReason: string | null
  shift: {
    date: string
    startTime: string
    endTime: string
    title: string | null
    location: { name: string }
    department: { name: string } | null
  }
}

interface CancelModalProps {
  assignmentId: string
  shiftLabel: string
  onSuccess: (id: string) => void
}

function CancelModal({ assignmentId, shiftLabel, onSuccess }: CancelModalProps) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await notifyCannotAttendAction(assignmentId, reason)
      if (result.success) {
        toast.success("We've been notified", 'Thanks for letting us know — we appreciate the heads up.')
        setOpen(false)
        setReason('')
        onSuccess(assignmentId)
      } else {
        toast.error('Could not update shift', result.error ?? 'Please try again.')
      }
    })
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button variant="outline" size="sm">Can&apos;t make it?</Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Can&apos;t make this shift?</ModalTitle>
          <ModalDescription>
            {shiftLabel} — let us know so we can find a replacement.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <div>
              <label htmlFor={`reason-${assignmentId}`} className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              <Textarea
                id={`reason-${assignmentId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Unwell, family commitment, work clash…"
                rows={3}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </ModalClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                'Notify Team'
              )}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

function ShiftCard({ assignment, showCancel }: { assignment: ShiftData; showCancel?: boolean; onCancel?: (id: string) => void }) {
  const timeRange = `${formatTime(assignment.shift.startTime)} – ${formatTime(assignment.shift.endTime)}`
  const locationInfo = [assignment.shift.location.name, assignment.shift.department?.name].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        {assignment.shift.title && (
          <p className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-0.5">
            {assignment.shift.title}
          </p>
        )}
        <p className="text-sm font-semibold text-gray-900">
          {formatAustralianDate(assignment.shift.date)}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">
          {timeRange} · {locationInfo}
        </p>
        {assignment.cancelReason && (
          <p className="text-xs text-gray-400 mt-1 italic">{assignment.cancelReason}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            SHIFT_STATUS_COLOURS[assignment.status] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {SHIFT_STATUS_LABELS[assignment.status] ?? assignment.status}
        </span>
      </div>
    </div>
  )
}

interface ShiftsClientProps {
  upcoming: ShiftData[]
  past: ShiftData[]
}

export default function ShiftsClient({ upcoming, past }: ShiftsClientProps) {
  const [upcomingShifts, setUpcomingShifts] = React.useState<ShiftData[]>(upcoming)

  function handleCancelled(id: string) {
    setUpcomingShifts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'CANCELLED_BY_VOLUNTEER' } : a
      )
    )
  }

  return (
    <div className="space-y-8">
      {/* Upcoming */}
      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-lg font-semibold text-gray-900 mb-3">
          Upcoming Shifts
        </h2>
        {upcomingShifts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-600">No upcoming shifts rostered</p>
              <p className="text-sm text-gray-400 mt-1">
                Our team will be in touch when there&apos;s a shift that matches your availability.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingShifts.map((assignment) => (
              <Card key={assignment.id}>
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <ShiftCard assignment={assignment} />
                    </div>
                    {assignment.status !== 'CANCELLED_BY_VOLUNTEER' && (
                      <div className="shrink-0">
                        <CancelModal
                          assignmentId={assignment.id}
                          shiftLabel={`${formatAustralianDate(assignment.shift.date)}, ${formatTime(assignment.shift.startTime)}`}
                          onSuccess={handleCancelled}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section aria-labelledby="past-heading">
        <h2 id="past-heading" className="text-lg font-semibold text-gray-900 mb-3">
          Past Shifts
        </h2>
        {past.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-gray-500">No past shifts on record yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {past.map((assignment) => (
              <Card key={assignment.id}>
                <CardContent className="py-4">
                  <ShiftCard assignment={assignment} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
