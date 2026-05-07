import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        // Volunteer status variants — matching VolunteerStatus Prisma enum values
        PENDING_INDUCTION: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        ACTIVE: 'bg-green-100 text-green-800 border border-green-200',
        INACTIVE: 'bg-gray-100 text-gray-700 border border-gray-200',
        ON_LEAVE: 'bg-blue-100 text-blue-700 border border-blue-200',
        SUSPENDED: 'bg-orange-100 text-orange-800 border border-orange-200',
        REMOVED: 'bg-red-100 text-red-800 border border-red-200',
        // Legacy — kept for any existing DB records
        INDUCTED: 'bg-green-100 text-green-800 border border-green-200',
        PAUSED: 'bg-blue-100 text-blue-700 border border-blue-200',
        // Generic UI variants
        default: 'bg-orange-100 text-orange-700 border border-orange-200',
        secondary: 'bg-amber-100 text-amber-800 border border-amber-200',
        outline: 'border border-gray-300 text-gray-700 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={clsx(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
