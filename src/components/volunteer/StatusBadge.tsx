import * as React from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'

/**
 * All values the VolunteerStatus enum can hold (including legacy).
 */
export type VolunteerStatus =
  | 'PENDING_INDUCTION'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'REMOVED'
  | 'INDUCTED'   // legacy
  | 'PAUSED'     // legacy

const STATUS_LABELS: Record<VolunteerStatus, string> = {
  PENDING_INDUCTION: 'Pending Induction',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
  SUSPENDED: 'Suspended',
  REMOVED: 'Removed',
  INDUCTED: 'Active',      // legacy — treat as active in display
  PAUSED: 'On Leave',      // legacy — treat as on leave in display
}

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: VolunteerStatus
}

export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  // Map legacy statuses to their visual equivalent
  const displayVariant: BadgeProps['variant'] =
    status === 'INDUCTED' ? 'ACTIVE'
    : status === 'PAUSED' ? 'ON_LEAVE'
    : status

  return (
    <Badge variant={displayVariant} {...props}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
