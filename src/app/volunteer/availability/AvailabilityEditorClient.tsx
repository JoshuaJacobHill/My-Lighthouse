'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { AvailabilityGrid, type AvailabilityMap, type TimePeriodConfig } from '@/components/volunteer/AvailabilityGrid'
import { updateAvailabilityAction } from '@/lib/actions/volunteer.actions'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface AvailabilityEditorClientProps {
  initialAvailability: AvailabilityMap
  timePeriods?: TimePeriodConfig[]
}

export default function AvailabilityEditorClient({ initialAvailability, timePeriods }: AvailabilityEditorClientProps) {
  const [availability, setAvailability] = React.useState<AvailabilityMap>(initialAvailability)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = React.useState<Date | null>(null)
  const { toast } = useToast()

  function handleSave() {
    // Convert AvailabilityMap to the flat array format the action expects
    const slots: Array<{ dayOfWeek: string; timePeriod: string }> = []

    for (const [day, periods] of Object.entries(availability)) {
      if (!periods) continue
      for (const [period, available] of Object.entries(periods)) {
        if (available) {
          slots.push({ dayOfWeek: day, timePeriod: period })
        }
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

  const selectedCount = Object.values(availability).reduce((total, periods) => {
    if (!periods) return total
    return total + Object.values(periods).filter(Boolean).length
  }, 0)

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <AvailabilityGrid
          value={availability}
          onChange={setAvailability}
          timePeriods={timePeriods}
        />

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-500">
            {selectedCount === 0 ? (
              'No availability selected'
            ) : (
              <span>
                <span className="font-semibold text-orange-600">{selectedCount}</span>{' '}
                {selectedCount === 1 ? 'slot' : 'slots'} selected
              </span>
            )}
            {savedAt && (
              <span className="ml-3 inline-flex items-center gap-1 text-green-600 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Saved {savedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
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
