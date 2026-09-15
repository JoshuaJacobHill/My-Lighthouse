import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { periodKey, isOverdue } from '@/lib/checklists'
import { brisbaneToday, calendarDay } from '@/lib/fitness-days'
import { isAdminRole } from '@/lib/permissions-core'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const P = 'margin:0 0 16px 0;line-height:1.7;color:#374151;font-size:15px;'

// ─── GET /api/cron/task-reminders ─────────────────────────────────────────────
//
// Runs once a day at 5pm Brisbane (Hobby plan allows daily crons only).
//
// Two different jobs with deliberately different reach:
//
//   Assigned tasks  — daily, to the one person the task belongs to.
//   Checklist       — Thursdays only, a summary, to admins.
//
// The checklist half used to go to every staff member, every day, listing
// every overdue item — which with 289 items in the template is a wall of text
// nobody can act on and everybody learns to delete. A backlog is a management
// question, not a to-do list, so it is now a count on one day of the week.
//
// Fails CLOSED (valid CRON_SECRET, or an admin session for a manual run).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`
  let byHand = false
  if (!hasValidSecret) {
    const session = await getSession()
    const isAdmin = isAdminRole(session?.role)
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    byHand = true
  }

  /**
   * `?checklist=now` runs the weekly summary on any day.
   *
   * For an admin checking what the email looks like without waiting for
   * Thursday. Deliberately not available to the cron token: a leaked token
   * should not be able to send staff email seven days a week.
   */
  const forceChecklist = byHand && request.nextUrl.searchParams.get('checklist') === 'now'

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000)
  let taskEmails = 0
  let checklistEmails = 0
  let outstandingChecklistItems = 0

  try {
    // ── Overdue assigned tasks — nag the assignee, at most once a day ──
    const overdueTasks = await prisma.staffTask.findMany({
      where: {
        status: 'OPEN',
        dueAt: { lt: now },
        assignedToId: { not: null },
        OR: [{ remindedAt: null }, { remindedAt: { lt: dayAgo } }],
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        assignedTo: { select: { id: true, email: true, name: true } },
      },
      take: 200,
    })

    // Group so someone with three overdue tasks gets one email, not three.
    const byUser = new Map<string, { email: string; name: string | null; titles: string[]; ids: string[] }>()
    for (const t of overdueTasks) {
      if (!t.assignedTo?.email) continue
      const g = byUser.get(t.assignedTo.id) ?? {
        email: t.assignedTo.email,
        name: t.assignedTo.name,
        titles: [],
        ids: [],
      }
      g.titles.push(t.title)
      g.ids.push(t.id)
      byUser.set(t.assignedTo.id, g)
    }

    for (const [, g] of byUser) {
      const firstName = g.name?.trim().split(/\s+/)[0] || 'there'
      const list = g.titles.map((t) => `<li style="margin-bottom:6px;">${t}</li>`).join('')
      try {
        await sendEmail({
          to: g.email,
          subject:
            g.titles.length === 1
              ? `Still to do: ${g.titles[0]}`
              : `${g.titles.length} tasks are past their due time`,
          html: wrapEmailHtml(
            `
            <p style="${P}">Hi ${firstName},</p>
            <p style="${P}">A quick nudge — ${g.titles.length === 1 ? 'this is' : 'these are'} past the due time:</p>
            <ul style="margin:0 0 18px 0;padding-left:20px;color:#374151;font-size:15px;">${list}</ul>
            <p style="margin:22px 0;"><a href="${APP_URL}/dashboard/tasks" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Open my tasks &rarr;</a></p>
            <p style="${P};margin-bottom:0;">Thanks,<br>The Lighthouse Care team</p>
          `,
            APP_URL
          ),
          text: `Hi ${firstName},\n\nPast the due time:\n${g.titles.map((t) => `- ${t}`).join('\n')}\n\nOpen your tasks: ${APP_URL}/dashboard/tasks`,
        })
        taskEmails++
        await prisma.staffTask.updateMany({ where: { id: { in: g.ids } }, data: { remindedAt: now } })
      } catch (err) {
        console.error('[task-reminders] task email failed', err)
      }
    }

    // ── Overdue recurring checklist items — a weekly summary for admins ──
    //
    // Thursday only. A daily nag about a standing backlog is noise: the same
    // items are outstanding on Wednesday as on Tuesday, and an email that
    // repeats itself every evening stops being read within a week. Thursday
    // leaves Friday and Saturday to act on it before the trading week closes.
    const brisbaneWeekday = new Date(`${brisbaneToday(now)}T00:00:00.000Z`).getUTCDay()
    const THURSDAY = 4
    const checklistDay = brisbaneWeekday === THURSDAY || forceChecklist

    if (checklistDay) {
      const items = await prisma.checklistItem.findMany({
        where: { isActive: true },
        select: {
          id: true,
          frequency: true,
          dueTime: true,
          weekday: true,
          dayOfMonth: true,
          location: { select: { name: true } },
        },
      })

      const byFrequency = new Map<string, number>()
      const byLocation = new Map<string, number>()
      let total = 0

      for (const i of items) {
        if (!isOverdue(i, now)) continue
        const done = await prisma.checklistCompletion.findUnique({
          where: { itemId_periodKey: { itemId: i.id, periodKey: periodKey(i.frequency, now) } },
          select: { id: true },
        })
        if (done) continue
        total++
        outstandingChecklistItems++
        byFrequency.set(i.frequency, (byFrequency.get(i.frequency) ?? 0) + 1)
        const where = i.location?.name ?? 'Everywhere'
        byLocation.set(where, (byLocation.get(where) ?? 0) + 1)
      }

      if (total > 0) {
        /**
         * Admins, not all staff.
         *
         * Checklist items carry a location and an area but never a person, so
         * there is no assignee to send this to — the closest honest audience
         * is whoever would chase a backlog. Giving items an owner would let
         * this be personal, and would be a schema change plus somewhere to
         * set it.
         */
        const everyone = await prisma.user.findMany({
          where: { isStaff: true, isActive: true, email: { not: '' } },
          select: { email: true, name: true, role: true },
        })
        const recipients = everyone.filter((u) => isAdminRole(u.role))

        const order = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
        const freqLine = order
          .filter((f) => byFrequency.has(f))
          .map((f) => `${byFrequency.get(f)} ${f.toLowerCase()}`)
          .join(', ')

        const placeLine = [...byLocation.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([place, n]) => `${place}: ${n}`)
          .join(' · ')

        for (const person of recipients) {
          const firstName = person.name?.trim().split(/\s+/)[0] || 'team'
          try {
            await sendEmail({
              to: person.email,
              subject: `${total} checklist item${total === 1 ? '' : 's'} outstanding`,
              html: wrapEmailHtml(
                `
                <p style="${P}">Hi ${firstName},</p>
                <p style="${P}"><strong style="font-size:22px;color:#111827;">${total}</strong> checklist item${total === 1 ? '' : 's'} ${total === 1 ? 'is' : 'are'} past the deadline and not ticked off.</p>
                <p style="${P}">${freqLine}.</p>
                <p style="${P};color:#6b7280;font-size:14px;">${placeLine}</p>
                <p style="margin:22px 0;"><a href="${APP_URL}/dashboard/tasks" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Open the checklist &rarr;</a></p>
                <p style="${P};margin-bottom:0;">Thanks,<br>The Lighthouse Care team</p>
              `,
                APP_URL
              ),
              text: `Hi ${firstName},\n\n${total} checklist item${total === 1 ? '' : 's'} past the deadline and not ticked off.\n${freqLine}.\n${placeLine}\n\nOpen the checklist: ${APP_URL}/dashboard/tasks`,
            })
            checklistEmails++
          } catch (err) {
            console.error('[task-reminders] checklist email failed', err)
          }
        }
      }
    }

    // Yesterday's notes on the challenge page. They are meant to last a day,
    // and the page only ever shows today's, so this is tidying rather than
    // anything the reader would notice.
    const day = calendarDay(brisbaneToday())
    const clearedCheers = day
      ? (await prisma.challengeCheer.deleteMany({ where: { day: { lt: day } } })).count
      : 0

    return NextResponse.json({
      ok: true,
      clearedCheers,
      overdueTasks: overdueTasks.length,
      taskEmails,
      // Says whether it looked, so a Tuesday run does not read as "nothing
      // outstanding" when it simply is not checklist day.
      checklistChecked: brisbaneWeekday === THURSDAY || forceChecklist,
      outstandingChecklistItems,
      checklistEmails,
    })
  } catch (err) {
    console.error('[task-reminders] failed', err)
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 })
  }
}
