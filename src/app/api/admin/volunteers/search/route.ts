import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasCapability } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('care.people'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) {
    return NextResponse.json({ volunteers: [] })
  }

  const volunteers = await prisma.volunteerProfile.findMany({
    where: {
      status: { not: 'REMOVED' },
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 10,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return NextResponse.json({ volunteers })
}
