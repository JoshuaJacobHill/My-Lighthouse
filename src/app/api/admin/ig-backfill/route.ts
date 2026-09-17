import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { backfillInstagram } from '@/lib/integrations/meta'
import { hasCapability } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── GET /api/admin/ig-backfill ──────────────────────────────────────────────
//
// Reads the Instagram back catalogue into SocialPost, a slice at a time.
//
// Why this exists separately from the nightly ingest: each post needs two
// insight requests, and several hundred posts is more than a minute of them.
// The nightly job never hits that because it only looks at recent posts — a
// backfill does, and gets killed mid-flight with nothing written.
//
// So this one works to a time budget. It reads as far as it can, writes what it
// read, and hands back the cursor it stopped at. Nothing is lost when it stops,
// because every post is written as it is read rather than at the end.
//
//   /api/admin/ig-backfill                 ← start, and keep going
//   /api/admin/ig-backfill?after=CURSOR    ← resume by hand
//   /api/admin/ig-backfill?posts=600       ← how far back to go
//   /api/admin/ig-backfill?once=1          ← one slice only, then report
//
// Admin only: this is a lot of Graph API quota to hand to anybody who finds the
// URL, and quota exhaustion takes the nightly numbers down with it.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('business.reports'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const q = new URL(request.url).searchParams
  const posts = Math.min(Math.max(Number(q.get('posts')) || 400, 1), 1000)
  const once = q.get('once') === '1'

  // Leave room to finish the slice in hand and return a response. Being killed
  // at the limit loses the cursor, which is the one thing worth keeping.
  const HARD_LIMIT_MS = 60_000
  const RESERVE_MS = 12_000
  const started = Date.now()

  // Posts read in the last hour are skipped. It makes a resumed run reach
  // further back each time instead of re-reading the same recent posts, and
  // their numbers have long since settled anyway.
  const SKIP_FRESH_HOURS = 1

  let after = q.get('after') ?? undefined
  let written = 0
  let scanned = 0
  let slices = 0

  for (;;) {
    const left = HARD_LIMIT_MS - (Date.now() - started) - RESERVE_MS
    if (left <= 2_000) break

    const res = await backfillInstagram({
      posts: posts - scanned,
      after,
      budgetMs: left,
      skipFreshHours: SKIP_FRESH_HOURS,
    })

    slices++
    written += res.written
    scanned += res.scanned

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error, written, scanned, resumeFrom: after ?? null },
        { status: 500 },
      )
    }

    after = res.nextAfter
    if (!after || scanned >= posts || once) break
  }

  const done = !after
  return NextResponse.json({
    ok: true,
    done,
    written,
    scanned,
    slices,
    tookMs: Date.now() - started,
    // The only thing the caller needs to come back with.
    resumeFrom: after ?? null,
    next: after
      ? `/api/admin/ig-backfill?after=${encodeURIComponent(after)}&posts=${posts - scanned}`
      : null,
    note: done
      ? 'Finished — nothing further back to read.'
      : 'Ran out of time. Open the `next` URL to carry on from here.',
  })
}
