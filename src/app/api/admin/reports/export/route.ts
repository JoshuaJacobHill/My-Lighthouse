import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { subDays, subMonths, subQuarters, startOfDay, format } from 'date-fns'
import { hasCapability } from '@/lib/permissions'

function getRangeStart(range: string): Date {
  const now = new Date()
  switch (range) {
    case 'week':
      return startOfDay(subDays(now, 7))
    case 'quarter':
      return startOfDay(subQuarters(now, 1))
    case 'month':
    default:
      return startOfDay(subMonths(now, 1))
  }
}

function csvEscape(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('care.people'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') ?? 'month'
  const rangeStart = getRangeStart(range)

  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { signInAt: { gte: rangeStart } },
      include: {
        volunteer: { select: { firstName: true, lastName: true, email: true, mobile: true } },
        location: { select: { name: true } },
      },
      orderBy: { signInAt: 'desc' },
    })

    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Mobile',
      'Location',
      'Sign In',
      'Sign Out',
      'Duration (mins)',
    ]

    const rows = records.map((r) => {
      return [
        r.volunteer?.firstName ?? '',
        r.volunteer?.lastName ?? '',
        r.volunteer?.email ?? '',
        r.volunteer?.mobile ?? '',
        r.location?.name ?? '',
        format(new Date(r.signInAt), 'dd/MM/yyyy HH:mm'),
        r.signOutAt ? format(new Date(r.signOutAt), 'dd/MM/yyyy HH:mm') : '',
        r.durationMins?.toString() ?? '',
      ]
        .map(csvEscape)
        .join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-${range}-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
      },
    })
  } catch (err) {
    console.error('[reports/export]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
