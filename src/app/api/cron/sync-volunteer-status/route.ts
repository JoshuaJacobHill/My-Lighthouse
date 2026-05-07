import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { renderTemplate } from '@/lib/email-templates'

// ─── Runs daily at 2 am AEST (16:00 UTC) ────────────────────────────────────
//
// Rules:
//
//  ACTIVE → INACTIVE
//    • Volunteer hasn't attended a shift in 3+ months, or
//    • Joined 3+ months ago and has never attended
//    → sends INACTIVITY_CHECKIN email
//
//  INACTIVE → ACTIVE
//    • Volunteer has attended a shift within the past 3 months
//    → they came back on their own — no email needed
//
//  Legacy cleanup (INDUCTED / PAUSED → modern equivalents)
//    • INDUCTED with recent attendance → ACTIVE
//    • INDUCTED with no recent attendance → INACTIVE + check-in email
//    • PAUSED → ON_LEAVE (rename only, no email)
//
//  NEVER touched by this job:
//    • ON_LEAVE  — volunteer requested break; admin must re-activate
//    • SUSPENDED — admin hold; admin must re-activate
//    • PENDING_INDUCTION — awaiting quiz
//    • REMOVED   — left the program

const THREE_MONTHS_AGO = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return d
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const cutoff = THREE_MONTHS_AGO()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://volunteer.lighthousecare.org.au'
  const portalLink = `${appUrl}/volunteer`

  let markedInactive = 0
  let markedActive = 0
  let legacyCleaned = 0
  const errors: string[] = []

  const systemUserId = await getSystemUserId()

  try {
    // ── 1. ACTIVE → INACTIVE ─────────────────────────────────────────────────

    const toDeactivate = await prisma.volunteerProfile.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { lastAttendedAt: null, joinedAt: { lt: cutoff } },
          { lastAttendedAt: { lt: cutoff } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    for (const v of toDeactivate) {
      try {
        await prisma.volunteerProfile.update({
          where: { id: v.id },
          data: { status: 'INACTIVE', deactivatedAt: new Date() },
        })

        if (systemUserId) {
          await prisma.adminNote.create({
            data: {
              volunteerId: v.id,
              content: 'Status automatically changed to INACTIVE — no attendance recorded in the past 3 months.',
              isInternal: true,
              createdById: systemUserId,
            },
          })
        }

        try {
          const template = await renderTemplate('INACTIVITY_CHECKIN', {
            first_name: v.firstName,
            last_name: v.lastName,
            portal_link: portalLink,
          })
          await sendEmail({
            to: v.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            templateType: 'INACTIVITY_CHECKIN',
            volunteerId: v.id,
          })
        } catch (emailErr) {
          console.error(`[sync-status] check-in email failed for ${v.email}:`, emailErr)
        }

        markedInactive++
      } catch (err) {
        errors.push(`Deactivate ${v.firstName} ${v.lastName}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // ── 2. INACTIVE → ACTIVE ─────────────────────────────────────────────────
    // Only reactivates INACTIVE — ON_LEAVE and SUSPENDED require admin action.

    const toActivate = await prisma.volunteerProfile.findMany({
      where: {
        status: 'INACTIVE',
        lastAttendedAt: { gte: cutoff },
      },
      select: { id: true, firstName: true, lastName: true },
    })

    for (const v of toActivate) {
      try {
        await prisma.volunteerProfile.update({
          where: { id: v.id },
          data: { status: 'ACTIVE' },
        })

        if (systemUserId) {
          await prisma.adminNote.create({
            data: {
              volunteerId: v.id,
              content: 'Status automatically changed to ACTIVE — attendance recorded within the past 3 months.',
              isInternal: true,
              createdById: systemUserId,
            },
          })
        }

        markedActive++
      } catch (err) {
        errors.push(`Activate ${v.firstName} ${v.lastName}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // ── 3. Legacy INDUCTED cleanup ────────────────────────────────────────────
    // Volunteers stuck in the old INDUCTED state get moved to ACTIVE (if they've
    // attended recently) or INACTIVE (if they haven't, and joined 3+ months ago).

    const inducted = await prisma.volunteerProfile.findMany({
      where: { status: 'INDUCTED' },
      select: { id: true, firstName: true, lastName: true, email: true, lastAttendedAt: true, joinedAt: true },
    })

    for (const v of inducted) {
      const hasRecentAttendance = v.lastAttendedAt && v.lastAttendedAt >= cutoff
      const isStale = !v.lastAttendedAt && v.joinedAt < cutoff

      if (hasRecentAttendance) {
        await prisma.volunteerProfile.update({ where: { id: v.id }, data: { status: 'ACTIVE' } })
        legacyCleaned++
      } else if (isStale) {
        await prisma.volunteerProfile.update({ where: { id: v.id }, data: { status: 'INACTIVE', deactivatedAt: new Date() } })
        // Send check-in email to stale inducted volunteers too
        try {
          const template = await renderTemplate('INACTIVITY_CHECKIN', {
            first_name: v.firstName, last_name: v.lastName, portal_link: portalLink,
          })
          await sendEmail({ to: v.email, subject: template.subject, html: template.html, text: template.text, templateType: 'INACTIVITY_CHECKIN', volunteerId: v.id })
        } catch { /* non-fatal */ }
        legacyCleaned++
      }
    }

    // ── 4. Legacy PAUSED → ON_LEAVE ───────────────────────────────────────────

    const paused = await prisma.volunteerProfile.findMany({
      where: { status: 'PAUSED' },
      select: { id: true },
    })

    for (const v of paused) {
      await prisma.volunteerProfile.update({ where: { id: v.id }, data: { status: 'ON_LEAVE' } })
      legacyCleaned++
    }

    return NextResponse.json({
      message: `Sync complete. ${markedInactive} → inactive, ${markedActive} → active, ${legacyCleaned} legacy records cleaned.`,
      markedInactive,
      markedActive,
      legacyCleaned,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[GET /api/cron/sync-volunteer-status]', err)
    return NextResponse.json({ error: 'Sync failed.' }, { status: 500 })
  }
}

let _systemUserId: string | null | undefined = undefined

async function getSystemUserId(): Promise<string | null> {
  if (_systemUserId !== undefined) return _systemUserId
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  _systemUserId = admin?.id ?? null
  return _systemUserId
}
