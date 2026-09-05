/**
 * Mailchimp — adding people to the audience, and reading campaign performance.
 *
 * Two unrelated jobs sharing one client. Subscribing happens inline when
 * someone signs up; campaign stats are pulled by the nightly cron into the same
 * SocialPost table the social platforms use, so "top performing" can rank an
 * email against an Instagram post.
 *
 * Auth is an API key, which carries the role of whoever created it — so it
 * should come from a dedicated admin account rather than a staff member whose
 * access might later be reduced, which would silently break this.
 */

import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'

export type MailchimpTag = 'Donor' | 'Volunteer' | 'Supporter'

type Cfg = { key: string; dc: string; audienceId: string }

export function mailchimpConfig(): Cfg | null {
  const key = process.env.MAILCHIMP_API_KEY
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID
  if (!key || !audienceId) return null
  // The data centre is the suffix on the key itself, e.g. "...-us6".
  const dc = key.split('-')[1]
  if (!dc) return null
  return { key, dc, audienceId }
}

async function mc<T>(
  cfg: Cfg,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`https://${cfg.dc}.api.mailchimp.com/3.0${path}`)
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v)

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${cfg.key}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })

  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(`Mailchimp ${path} ${res.status}: ${json.detail ?? json.title ?? text.slice(0, 200)}`)
  }
  return json as T
}

/** Mailchimp addresses a member by the MD5 of their lowercased email. */
function memberId(email: string): string {
  return createHash('md5').update(email.trim().toLowerCase()).digest('hex')
}

/**
 * Put someone on the audience with a tag.
 *
 * `status_if_new` is doing important work: a brand-new person is subscribed,
 * but someone who previously unsubscribed keeps that status rather than being
 * quietly put back on the list. Mailchimp rejects resubscribing via the API
 * anyway, and it is the behaviour that keeps the account in good standing.
 *
 * Never throws into the caller. Signing up as a volunteer must not fail
 * because a marketing platform was having a moment.
 */
export async function subscribe(
  email: string,
  opts: { firstName?: string | null; lastName?: string | null; tags: MailchimpTag[] },
): Promise<{ ok: boolean; error?: string }> {
  const cfg = mailchimpConfig()
  if (!cfg) return { ok: false, error: 'Mailchimp not configured' }
  if (!email?.includes('@')) return { ok: false, error: 'not an email' }

  try {
    await mc(cfg, `/lists/${cfg.audienceId}/members/${memberId(email)}`, {
      method: 'PUT',
      body: {
        email_address: email.trim(),
        status_if_new: 'subscribed',
        merge_fields: {
          ...(opts.firstName ? { FNAME: opts.firstName } : {}),
          ...(opts.lastName ? { LNAME: opts.lastName } : {}),
        },
      },
    })

    // Tags are a separate call; PUT to the member does not accept them.
    await mc(cfg, `/lists/${cfg.audienceId}/members/${memberId(email)}/tags`, {
      method: 'POST',
      body: { tags: opts.tags.map((name) => ({ name, status: 'active' })) },
    })

    return { ok: true }
  } catch (err) {
    console.error('mailchimp subscribe failed', err)
    return { ok: false, error: (err as Error).message }
  }
}

// ── Campaign reporting ───────────────────────────────────────────────────────

type Report = {
  id: string
  campaign_title?: string
  subject_line?: string
  send_time?: string
  emails_sent?: number
  opens?: {
    opens_total?: number
    unique_opens?: number
    /**
     * Apple Mail preloads tracking pixels, so raw opens are inflated. These
     * fields exclude that, and they are the only ones worth showing anyone.
     */
    proxy_excluded_unique_opens?: number
  }
  clicks?: { clicks_total?: number; unique_clicks?: number }
}

/**
 * Pull recent campaign performance into SocialPost.
 *
 * An email is not a post, but the question being asked — what did best in
 * September — spans both, and keeping them in one table makes that a sort
 * rather than a merge of two shapes.
 */
export async function ingestMailchimp(
  { days = 120 }: { days?: number } = {},
): Promise<{ ok: boolean; rows: number; error?: string }> {
  const cfg = mailchimpConfig()
  const run = await prisma.ingestRun.create({ data: { source: 'mailchimp' }, select: { id: true } })

  if (!cfg) {
    const error = 'MAILCHIMP_API_KEY / MAILCHIMP_AUDIENCE_ID not configured'
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: false, error, finishedAt: new Date() },
    })
    return { ok: false, rows: 0, error }
  }

  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const res = await mc<{ reports: Report[] }>(cfg, '/reports', {
      query: { count: '200', since_send_time: since },
    })

    let rows = 0
    for (const r of res.reports ?? []) {
      if (!r.send_time) continue

      const sent = r.emails_sent ?? 0
      // Opens with Apple's preloading removed; falls back to unique opens on
      // older campaigns that predate the field.
      const opens = r.opens?.proxy_excluded_unique_opens ?? r.opens?.unique_opens ?? 0
      const clicks = r.clicks?.unique_clicks ?? 0

      await prisma.socialPost.upsert({
        where: { platform_externalId: { platform: 'MAILCHIMP', externalId: r.id } },
        create: {
          platform: 'MAILCHIMP',
          kind: 'ORGANIC',
          externalId: r.id,
          caption: r.subject_line || r.campaign_title || null,
          publishedAt: new Date(r.send_time),
          // Emails sent is the closest thing an email has to "times shown",
          // which keeps the engagement rate comparable with a post's.
          views: sent,
          reach: sent,
          engagements: opens,
          clicks,
        },
        update: {
          caption: r.subject_line || r.campaign_title || null,
          views: sent,
          reach: sent,
          engagements: opens,
          clicks,
          fetchedAt: new Date(),
        },
      })
      rows++
    }

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: true, rows, finishedAt: new Date() },
    })
    return { ok: true, rows }
  } catch (err) {
    const error = (err as Error).message.slice(0, 500)
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { ok: false, error, finishedAt: new Date() },
    })
    return { ok: false, rows: 0, error }
  }
}
