import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import KioskClient from './KioskClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Volunteer Check-In | Lighthouse Care',
}

export default async function KioskPage() {
  const session = await getSession()
  if (!session) redirect('/kiosk/login')

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  const defaultLocation = locations.find(
    (l) => l.name.toLowerCase().includes('loganholme')
  ) ?? locations[0]

  return (
    <KioskClient
      locations={locations}
      defaultLocationId={defaultLocation?.id}
    />
  )
}
