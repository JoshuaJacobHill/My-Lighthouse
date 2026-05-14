'use client'

import * as React from 'react'
import { useTransition } from 'react'
import {
  AvailabilityCheckboxGrid,
  PERIODS,
  type AvailabilityPeriodMap,
  type AvailabilityPeriodKey,
} from '@/components/volunteer/AvailabilityCheckboxGrid'
import { updateAvailabilityAction } from '@/lib/actions/volunteer.actions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface AvailabilityEditorClientProps {
  initialAvailability: AvailabilityPeriodMap
}

export default function AvailabilityEditorClient({ initialAvailability }: AvailabilityEditorClientProps) {
  const [availability, setAvailability] = React.useState<AvailabilityPeriodMap>(initialAvailability)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = React.useState<Date | null>(null)
  const { toast } = useToast()

  function handleSave() {
    // Flatten AvailabilityPeriodMap → array of {dayOfWeek, timePeriod} items
    const slots: Array<{ dayOfWeek: string; timePeriod: string; startTime: string; endTime: string }> = []

    for (const [day, periods] of Object.entries(availability)) {
      if (!periods) continue
      for (const periodKey of periods as AvailabilityPeriodKey[]) {
        const period = PERIODS.find((p) => p.key === periodKey)
        if (!period) continue
        slots.push({
          dayOfWeek: day,
          timePeriod: periodKey,
          startTime: period.startTime,
          endTime: period.endTime,
        })
      }
    }

    startTransition(async () => {
      const result = await updateAvailabilityAction({ availability: slots })
      if (result.success) {
        setSavedAt(new Date())
        toast.success('Availability saved', 'Your availability has been updated.')
      } else {
        toast.error('Could not save availability', result.error ?? 'Please try again.')
      }
    })
  }

  const totalSelected = Object.values(availability).reduce((n, p) => n + (p?.length ?? 0), 0)

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <AvailabilityCheckboxGrid
          value={availability}
          onChange={setAvailability}
        />

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-500">
            {totalSelected === 0 ? (
              'No availability set — tick the times you&apos;re generally free'
            ) : (
              <span>
                <span className="font-semibold text-orange-600">{totalSelected}</span>{' '}
                {totalSelected === 1 ? 'session' : 'sessions'} selected
              </span>
            )}
            {savedAt && (
              <span className="ml-3 inline-flex items-center gap-1 text-green-600 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Saved {savedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Brisbane' })}
              </span>
            )}
          </div>
          <Button onClick={handleSave} disabled={isPending} className="min-w-28">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save Availability'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
