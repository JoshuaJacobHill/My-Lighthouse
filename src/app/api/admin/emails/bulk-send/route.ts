import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { hasCapability } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('system.settings'))) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const { mode, locationId, interest, subject, body: messageBody } = body

  if (!subject || !messageBody) {
    return NextResponse.json(
      { success: false, error: 'Subject and body are required.' },
      { status: 400 }
    )
  }

  try {
    // Fetch recipients
    let volunteers: Array<{ id: string; email: string; firstName: string; lastName: string }>

    if (mode === 'by-location' && locationId) {
      volunteers = await prisma.volunteerProfile.findMany({
        where: { status: 'ACTIVE', preferredLocations: { has: locationId } },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    } else if (mode === 'by-interest' && interest) {
      volunteers = await prisma.volunteerProfile.findMany({
        where: { status: 'ACTIVE', areasOfInterest: { has: interest } },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    } else {
      // mode === 'all' or fallback
      volunteers = await prisma.volunteerProfile.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    }

    // Send in batches — fire and forget for large lists
    let sent = 0
    for (const volunteer of volunteers) {
      const personalised = messageBody.replace(/\{\{first_name\}\}/g, volunteer.firstName)
      const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">${personalised.replace(/\n/g, '<br/>')}</div>`

      try {
        await sendEmail({
          to: volunteer.email,
          subject,
          html: htmlBody,
          templateType: 'CUSTOM',
          volunteerId: volunteer.id,
        })
        sent++
      } catch {
        // Continue sending to others even if one fails
      }
    }

    return NextResponse.json({ success: true, sent })
  } catch (err) {
    console.error('[bulk-send]', err)
    return NextResponse.json({ success: false, error: 'Failed to send emails.' }, { status: 500 })
  }
}
