import { wrapEmailHtml } from '@/lib/email-html'
import type { VolunteerDigest, DigestPerson } from '@/lib/volunteer-digest'

/**
 * Renders the weekly coordinator digest. Facts always; the AI write-up sits on
 * top when it's available, and its absence should be invisible to the reader.
 */

const P = 'margin:0 0 16px 0;line-height:1.7;color:#374151;font-size:15px;'
const H = 'margin:28px 0 12px 0;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#111827;'
const MUTED = 'color:#6b7280;'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** One big number with its label — the three-across comparison at the top. */
function statCell(value: string, label: string, accent = false): string {
  return `<td align="center" style="padding:14px 8px;">
    <div style="font-size:30px;font-weight:800;line-height:1;color:${accent ? '#f97316' : '#111827'};">${value}</div>
    <div style="margin-top:6px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;">${label}</div>
  </td>`
}

function peopleList(items: DigestPerson[]): string {
  return `<ul style="margin:0 0 4px 0;padding-left:20px;color:#374151;font-size:15px;line-height:1.7;">${items
    .map((p) => `<li><strong>${esc(p.name)}</strong> <span style="${MUTED}">— ${esc(p.detail)}</span></li>`)
    .join('')}</ul>`
}

function section(title: string, body: string): string {
  return `<p style="${H}">${title}</p>${body}`
}

export function digestSubject(d: VolunteerDigest): string {
  const change =
    d.volunteersThisWeek > d.volunteersLastWeek
      ? ` (up from ${d.volunteersLastWeek})`
      : d.volunteersThisWeek < d.volunteersLastWeek
        ? ` (down from ${d.volunteersLastWeek})`
        : ''
  return `${d.store} volunteers, ${d.weekLabel}: ${d.volunteersThisWeek} in${change}`
}

export function digestHtml(d: VolunteerDigest, appUrl: string): string {
  const n = d.narrative

  const writeUp = n
    ? `
    <div style="margin:0 0 8px 0;border-left:3px solid #f97316;padding-left:16px;">
      ${n.goodNews ? `<p style="${H};margin-top:0;color:#f97316;">Good news</p><p style="${P}">${esc(n.goodNews)}</p>` : ''}
      ${n.needsAttention ? `<p style="${H}">Needs attention</p><p style="${P}">${esc(n.needsAttention)}</p>` : ''}
      ${n.general?.trim() ? `<p style="${H}">General</p><p style="${P}">${esc(n.general)}</p>` : ''}
    </div>`
    : ''

  const lastYearCell = d.hasLastYearData
    ? statCell(String(d.volunteersSameWeekLastYear), 'same week last year')
    : statCell(String(d.visitsThisWeek), 'shifts worked')

  const rows: string[] = []

  if (d.newThisWeek.length > 0) rows.push(section('New sign-ups', peopleList(d.newThisWeek)))
  if (d.firstShiftThisWeek.length > 0) rows.push(section('First ever shift', peopleList(d.firstShiftThisWeek)))
  if (d.milestones.length > 0) rows.push(section('Milestones', peopleList(d.milestones)))
  if (d.comingMoreOften.length > 0) rows.push(section('Coming in more often', peopleList(d.comingMoreOften)))
  if (d.droppedOff.length > 0) {
    rows.push(
      section(
        'Regulars who have gone quiet',
        `<p style="${P};margin-bottom:10px;${MUTED}">Worth a quick text or call — they were coming regularly.</p>${peopleList(d.droppedOff)}`
      )
    )
  }

  if (d.comments.length > 0) {
    rows.push(
      section(
        `What volunteers said${d.averageRating != null ? ` — ${d.averageRating}/5 from ${d.ratingCount} rating${d.ratingCount === 1 ? '' : 's'}` : ''}`,
        d.comments
          .map(
            (c) =>
              `<div style="margin:0 0 12px 0;padding:12px 14px;background:#f9fafb;border-radius:10px;">
                <div style="font-size:15px;line-height:1.6;color:#374151;">&ldquo;${esc(c.comment)}&rdquo;</div>
                <div style="margin-top:6px;font-size:13px;${MUTED}">${esc(c.name)}${c.rating != null ? ` &middot; ${c.rating}/5` : ''}</div>
              </div>`
          )
          .join('')
      )
    )
  } else if (d.ratingCount > 0) {
    rows.push(
      section(
        'Ratings',
        `<p style="${P}">${d.ratingCount} volunteer${d.ratingCount === 1 ? '' : 's'} rated their shift this week, averaging ${d.averageRating}/5. No written comments.</p>`
      )
    )
  }

  const quiet =
    d.volunteersThisWeek === 0 && rows.length === 0
      ? `<p style="${P}">No volunteer shifts were recorded at ${esc(d.store)} this week.</p>`
      : ''

  return wrapEmailHtml(
    `
    <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#f97316;">Weekly volunteer digest</p>
    <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:800;color:#111827;">${esc(d.store)}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;${MUTED}">${esc(d.weekLabel)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:14px;margin-bottom:24px;">
      <tr>
        ${statCell(String(d.volunteersThisWeek), 'volunteers in', true)}
        ${statCell(String(d.volunteersLastWeek), 'week before')}
        ${lastYearCell}
        ${statCell(String(d.hoursThisWeek), 'hours')}
      </tr>
    </table>

    ${writeUp}
    ${quiet}

    <p style="${H}">The roster — ${d.rosterTotal} volunteer${d.rosterTotal === 1 ? '' : 's'}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;color:#374151;">
      ${rosterRow('Active', d.active, 'in within the last 6 weeks')}
      ${rosterRow('Lapsing', d.lapsing, 'last in 6–12 weeks ago', d.lapsing > 0)}
      ${rosterRow('Lapsed', d.lapsed, '12+ weeks, or never started')}
      ${rosterRow('Induction not finished', d.pendingInduction, 'signed up, quiz still to do', d.pendingInduction > 0)}
      ${rosterRow('First shift to come', d.awaitingFirstShift, 'inducted and waiting')}
      ${rosterRow('On a break or hold', d.onHold, '')}
    </table>

    ${rows.join('')}

    <p style="margin:30px 0 22px 0;"><a href="${appUrl}/admin/volunteers" style="background:#f97316;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px;">Open the volunteer list &rarr;</a></p>
    <p style="${P};margin-bottom:0;font-size:13px;${MUTED}">Hours only count shifts that were signed out on the kiosk. Reply to this email if a number looks wrong &mdash; it usually means a shift wasn&rsquo;t signed out.</p>
  `,
    appUrl
  )
}

function rosterRow(label: string, count: number, hint: string, highlight = false): string {
  if (count === 0 && !highlight) return ''
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;">
      <strong style="color:${highlight ? '#b45309' : '#111827'};">${count}</strong> ${label}
      ${hint ? `<span style="${MUTED};font-size:13px;"> — ${hint}</span>` : ''}
    </td>
  </tr>`
}

export function digestText(d: VolunteerDigest): string {
  const n = d.narrative
  const lines: string[] = [
    `${d.store} — weekly volunteer digest`,
    d.weekLabel,
    '',
    `Volunteers in this week: ${d.volunteersThisWeek}`,
    `Week before: ${d.volunteersLastWeek}`,
    ...(d.hasLastYearData ? [`Same week last year: ${d.volunteersSameWeekLastYear}`] : []),
    `Shifts worked: ${d.visitsThisWeek}    Hours: ${d.hoursThisWeek}`,
    '',
  ]

  if (n) {
    if (n.goodNews) lines.push('GOOD NEWS', n.goodNews, '')
    if (n.needsAttention) lines.push('NEEDS ATTENTION', n.needsAttention, '')
    if (n.general?.trim()) lines.push('GENERAL', n.general, '')
  }

  lines.push(
    `ROSTER (${d.rosterTotal})`,
    `Active: ${d.active}   Lapsing: ${d.lapsing}   Lapsed: ${d.lapsed}`,
    `Induction not finished: ${d.pendingInduction}   First shift to come: ${d.awaitingFirstShift}   On hold: ${d.onHold}`,
    ''
  )

  const block = (title: string, items: DigestPerson[]) => {
    if (items.length === 0) return
    lines.push(title.toUpperCase(), ...items.map((p) => `- ${p.name} — ${p.detail}`), '')
  }
  block('New sign-ups', d.newThisWeek)
  block('First ever shift', d.firstShiftThisWeek)
  block('Milestones', d.milestones)
  block('Coming in more often', d.comingMoreOften)
  block('Regulars who have gone quiet', d.droppedOff)

  if (d.comments.length > 0) {
    lines.push('WHAT VOLUNTEERS SAID', ...d.comments.map((c) => `- "${c.comment}" — ${c.name}${c.rating != null ? ` (${c.rating}/5)` : ''}`), '')
  }

  return lines.join('\n')
}
