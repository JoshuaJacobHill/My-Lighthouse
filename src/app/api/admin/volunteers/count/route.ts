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
  const mode = searchParams.get('mode')
  const locationId = searchParams.get('locationId')
  const interest = searchParams.get('interest')

  let count = 0

  try {
    if (mode === 'all') {
      count = await prisma.volunteerProfile.count({
        where: { status: 'ACTIVE' },
      })
    } else if (mode === 'by-location' && locationId) {
      count = await prisma.volunteerProfile.count({
        where: {
          status: 'ACTIVE',
          preferredLocations: { has: locationId },
        },
      })
    } else if (mode === 'by-interest' && interest) {
      count = await prisma.volunteerProfile.count({
        where: {
          status: 'ACTIVE',
          areasOfInterest: { has: interest },
        },
      })
    } else if (mode === 'by-location') {
      // No location filter — all active
      count = await prisma.volunteerProfile.count({ where: { status: 'ACTIVE' } })
    } else if (mode === 'by-interest') {
      // No interest filter — all active
      count = await prisma.volunteerProfile.count({ where: { status: 'ACTIVE' } })
    }
  } catch (err) {
    console.error('[volunteers/count]', err)
  }

  return NextResponse.json({ count })
}
