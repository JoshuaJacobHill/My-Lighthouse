import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { wrapEmailHtml } from '@/lib/email-html'
import { getCoordinatorEmail } from '@/lib/coordinators'
import { getVolunteersExpected, dayLabel, type StoreDay } from '@/lib/volunteers-today'
import { brisbaneToday } from '@/lib/fitness-days'
import { isAdminRole } from '@/lib/permissions-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'
const P = 'margin:0 0 18px 0;line-height:1.7;color:#374151;font-size:15px;'

// ─── GET /api/cron/volunteers-today ──────────────────────────────────────────
//
// Daily, 6am Brisbane. One email per store to that store's coordinator, listing
// who is expected in today and when, so they know who to look out for.
//
// Silent when a store has nobody booked — an empty list every Sunday teaches
// people to stop reading it.
//
// Fails CLOSED: a valid CRON_SECRET, or an admin session for a manual run.
// Admins can add ?preview=1 to see the email without sending, and ?day=2026-09-04
// to check another date.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasValidSecret = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  let isAdmin = false
  if (!hasValidSecret) {
    const session = await getSession()
    isAdmin = isAdminRole(session?.role)
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Preview and date override are admin conveniences — a cron token cannot use
  // them to dump the roster for an arbitrary day.
  const url = new URL(request.url)
  const preview = isAdmin && url.searchParams.get('preview') === '1'
  const day = (isAdmin && url.searchParams.get('day')) || brisbaneToday()

  try {
    const stores = await getVolunteersExpected(day)

    if (stores.length === 0) {
      return NextResponse.json({ ok: true, day, sent: 0, note: 'nobody booked today' })
    }

    const results: { store: string; to: string; volunteers: number; sent: boolean }[] = []

    for (const store of stores) {
      const to = await getCoordinatorEmail(store.location)
      if (preview) {
        results.push({ store: store.location, to, volunteers: store.volunteers.length, sent: false })
        continue
      }

      try {
        await sendEmail({
          to,
          subject: subjectFor(store, day),
          html: wrapEmailHtml(bodyHtml(store, day), APP_URL),
          text: bodyText(store, day),
        })
        results.push({ store: store.location, to, volunteers: store.volunteers.length, sent: true })
      } catch (err) {
        // One store's mail failing must not stop the other's.
        console.error(`volunteers-today: ${store.location} email failed`, err)
        results.push({ store: store.location, to, volunteers: store.volunteers.length, sent: false })
      }
    }

    return NextResponse.json({
      ok: true,
      day,
      preview,
      sent: results.filter((r) => r.sent).length,
      results,
      ...(preview ? { html: stores.map((s) => bodyHtml(s, day)) } : {}),
    })
  } catch (err) {
    console.error('volunteers-today failed', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

function subjectFor(store: StoreDay, day: string): string {
  const n = store.volunteers.length
  return `${n} volunteer${n === 1 ? '' : 's'} in at ${store.location} today`
}

function bodyHtml(store: StoreDay, day: string): string {
  const unconfirmed = store.volunteers.filter((v) => !v.confirmed).length

  const rows = store.volunteers
    .map(
      (v) => `
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:15px;color:#111827;font-weight:600;">
          ${v.name}${v.confirmed ? '' : ' <span style="font-weight:600;font-size:12px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:2px 8px;">not confirmed</span>'}
        </td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:15px;color:#374151;white-space:nowrap;">
          ${v.start} – ${v.end}${v.shiftTitle ? `<br><span style="font-size:13px;color:#6b7280;">${v.shiftTitle}</span>` : ''}
        </td>
      </tr>`,
    )
    .join('')

  return `
    <p style="${P}">Good morning,</p>
    <p style="${P}">Here is who is expected at <strong>${store.location}</strong> on ${dayLabel(day)}:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;width:100%;margin:6px 0 18px;border-collapse:separate;">
      ${rows}
    </table>
    ${
      unconfirmed > 0
        ? `<p style="${P}">${unconfirmed === 1 ? 'One person has' : `${unconfirmed} people have`} not confirmed yet, so they may not turn up.</p>`
        : ''
    }
    <p style="margin:22px 0;"><a href="${APP_URL}/admin/roster" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Open the roster &rarr;</a></p>
    <p style="${P};margin-bottom:0;">Thanks,<br>The Lighthouse Care team</p>
  `
}

function bodyText(store: StoreDay, day: string): string {
  const lines = store.volunteers
    .map((v) => `- ${v.name}  ${v.start} – ${v.end}${v.confirmed ? '' : '  (not confirmed)'}`)
    .join('\n')
  return `Good morning,\n\nExpected at ${store.location} on ${dayLabel(day)}:\n\n${lines}\n\nRoster: ${APP_URL}/admin/roster\n\nThanks,\nThe Lighthouse Care team`
}
