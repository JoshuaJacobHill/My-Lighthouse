import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { periodKey, isOverdue } from '@/lib/checklists'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const P = 'margin:0 0 16px 0;line-height:1.7;color:#374151;font-size:15px;'

// ─── GET /api/cron/task-reminders ─────────────────────────────────────────────
//
// Runs once a day at 5pm Brisbane (Hobby plan allows daily crons only). Chases
// anything past its hard deadline: overdue assigned tasks go to the person they
// belong to, overdue checklist items go to every staff member. Fails CLOSED
// (valid CRON_SECRET, or an admin session for a manual run).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`
  if (!hasValidSecret) {
    const session = await getSession()
    const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN'
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000)
  let taskEmails = 0
  let checklistEmails = 0

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

    // ── Overdue recurring checklist items — tell the staff team ──
    const items = await prisma.checklistItem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        frequency: true,
        dueTime: true,
        weekday: true,
        dayOfMonth: true,
        location: { select: { name: true } },
      },
    })

    const stillOpen: { title: string; where: string | null; freq: string }[] = []
    for (const i of items) {
      if (!isOverdue(i, now)) continue
      const done = await prisma.checklistCompletion.findUnique({
        where: { itemId_periodKey: { itemId: i.id, periodKey: periodKey(i.frequency, now) } },
        select: { id: true },
      })
      if (!done) stillOpen.push({ title: i.title, where: i.location?.name ?? null, freq: i.frequency })
    }

    if (stillOpen.length > 0) {
      const staff = await prisma.user.findMany({
        where: { isStaff: true, isActive: true, email: { not: '' } },
        select: { email: true, name: true },
      })
      const list = stillOpen
        .map(
          (s) =>
            `<li style="margin-bottom:6px;">${s.title}<span style="color:#9ca3af;"> — ${s.freq.toLowerCase()}${s.where ? `, ${s.where}` : ''}</span></li>`
        )
        .join('')

      for (const person of staff) {
        const firstName = person.name?.trim().split(/\s+/)[0] || 'team'
        try {
          await sendEmail({
            to: person.email,
            subject: `${stillOpen.length} checklist item${stillOpen.length === 1 ? '' : 's'} still outstanding`,
            html: wrapEmailHtml(
              `
              <p style="${P}">Hi ${firstName},</p>
              <p style="${P}">${stillOpen.length === 1 ? 'This is' : 'These are'} past the deadline and not ticked off yet:</p>
              <ul style="margin:0 0 18px 0;padding-left:20px;color:#374151;font-size:15px;">${list}</ul>
              <p style="${P}">If someone has already done it, just tick it off so the team knows.</p>
              <p style="margin:22px 0;"><a href="${APP_URL}/dashboard/tasks" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Open the checklist &rarr;</a></p>
              <p style="${P};margin-bottom:0;">Thanks,<br>The Lighthouse Care team</p>
            `,
              APP_URL
            ),
            text: `Hi ${firstName},\n\nPast deadline and not ticked off:\n${stillOpen
              .map((s) => `- ${s.title} (${s.freq.toLowerCase()}${s.where ? `, ${s.where}` : ''})`)
              .join('\n')}\n\nOpen the checklist: ${APP_URL}/dashboard/tasks`,
          })
          checklistEmails++
        } catch (err) {
          console.error('[task-reminders] checklist email failed', err)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      overdueTasks: overdueTasks.length,
      taskEmails,
      outstandingChecklistItems: stillOpen.length,
      checklistEmails,
    })
  } catch (err) {
    console.error('[task-reminders] failed', err)
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 })
  }
}
