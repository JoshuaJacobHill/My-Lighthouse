import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasCapability } from '@/lib/permissions'

export async function GET() {
  const session = await getSession()
  if (!session || !(await hasCapability('system.settings'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  return NextResponse.json({ locations })
}
