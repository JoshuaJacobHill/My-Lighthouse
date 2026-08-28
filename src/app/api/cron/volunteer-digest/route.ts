import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { getCoordinatorEmail, type StoreLocation } from '@/lib/coordinators'
import { buildVolunteerDigests } from '@/lib/volunteer-digest'
import { writeDigestNarrative } from '@/lib/digest-narrative'
import { digestHtml, digestText, digestSubject } from '@/lib/digest-email'
import { isAdminRole } from '@/lib/permissions-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.lighthousecare.org.au'

// ─── GET /api/cron/volunteer-digest ───────────────────────────────────────────
//
// Weekly, Monday morning Brisbane. One email per store to that store's
// coordinator, covering the week that just finished: who came, who's coming more
// often, who has gone quiet, and what volunteers said about their shift.
//
// Every figure is computed in `volunteer-digest.ts`. The AI write-up is optional
// — with no ANTHROPIC_API_KEY the email sends as facts only, which is why the
// narrative call is allowed to fail without failing the run.
//
// Fails CLOSED: a valid CRON_SECRET, or an admin session for a manual run.
// Admins can also add ?preview=1 to see the rendered email without sending, and
// ?store=Hillcrest to work on one store.
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

  // Preview is an admin-only convenience — a cron token can't use it to dump
  // volunteer names and attendance patterns out of the endpoint.
  const preview = isAdmin && request.nextUrl.searchParams.get('preview') === '1'
  const onlyStore = request.nextUrl.searchParams.get('store')

  try {
    let digests = await buildVolunteerDigests()
    if (onlyStore) digests = digests.filter((d) => d.store.toLowerCase() === onlyStore.toLowerCase())
    if (digests.length === 0) return NextResponse.json({ error: 'Unknown store' }, { status: 400 })

    // Both write-ups at once — two sequential Opus calls would risk the
    // function timeout, and a slow one already falls back to facts only.
    const narratives = await Promise.all(digests.map((d) => writeDigestNarrative(d)))
    digests.forEach((d, i) => {
      d.narrative = narratives[i]
    })

    if (preview) {
      const html = digests.map((d) => digestHtml(d, APP_URL)).join('<hr style="margin:40px 0;">')
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const results: { store: StoreLocation; to: string; sent: boolean; hadNarrative: boolean }[] = []
    for (const d of digests) {
      const to = await getCoordinatorEmail(d.store)
      try {
        await sendEmail({
          to,
          subject: digestSubject(d),
          html: digestHtml(d, APP_URL),
          text: digestText(d),
        })
        results.push({ store: d.store, to, sent: true, hadNarrative: d.narrative !== null })
      } catch (err) {
        console.error(`[volunteer-digest] send failed for ${d.store}`, err)
        results.push({ store: d.store, to, sent: false, hadNarrative: d.narrative !== null })
      }
    }

    return NextResponse.json({
      ok: true,
      week: digests[0]?.weekLabel,
      aiWriteUp: process.env.ANTHROPIC_API_KEY ? 'enabled' : 'not configured',
      results,
    })
  } catch (err) {
    console.error('[volunteer-digest] failed', err)
    return NextResponse.json({ error: 'Digest run failed' }, { status: 500 })
  }
}
