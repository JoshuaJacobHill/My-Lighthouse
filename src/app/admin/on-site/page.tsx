import prisma from '@/lib/prisma'
import { OnSiteClient } from '@/components/admin/OnSiteClient'
import { requireCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function OnSitePage() {
  await requireCapability('care.people')
  const [registeredRecords, guestRecords] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { signOutAt: null },
      include: {
        volunteer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            emergencyName: true,
            emergencyPhone: true,
          },
        },
        location: { select: { name: true } },
      },
      orderBy: { signInAt: 'asc' },
    }),
    prisma.guestAttendanceRecord.findMany({
      where: { signOutAt: null },
      include: {
        location: { select: { name: true } },
      },
      orderBy: { signInAt: 'asc' },
    }),
  ])

  return (
    <OnSiteClient
      registered={registeredRecords}
      guests={guestRecords}
    />
  )
}
