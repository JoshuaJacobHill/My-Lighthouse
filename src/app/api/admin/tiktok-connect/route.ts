import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { tiktokConfig, TIKTOK_AUTHORIZE_URL, TIKTOK_SCOPES } from '@/lib/integrations/tiktok'

export const dynamic = 'force-dynamic'

/** Where TikTok sends the browser back. Must match the app's registered URI exactly. */
export function redirectUri(request: NextRequest): string {
  return process.env.TIKTOK_REDIRECT_URI || `${request.nextUrl.origin}/api/admin/tiktok-callback`
}

export const STATE_COOKIE = 'tiktok_oauth_state'

// ─── GET /api/admin/tiktok-connect ───────────────────────────────────────────
//
// Start the one-time TikTok authorisation.
//
// A refresh token can only be created by a person approving the app in a
// browser — there is no equivalent of Meta's system user, which is the whole
// reason this route exists rather than a settings field.
//
// Run once. Afterwards the stored token rotates itself, and this is only
// needed again if it lapses (a year unused) or the app's scopes change.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('business.reports'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const cfg = tiktokConfig()
  if (!cfg) {
    return NextResponse.json(
      { error: 'TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET are not set in the environment.' },
      { status: 400 },
    )
  }

  // Guards against a forged callback: only a request that started here can
  // finish here, because only this response sets the matching cookie.
  const state = randomBytes(24).toString('hex')

  const url = new URL(TIKTOK_AUTHORIZE_URL)
  url.searchParams.set('client_key', cfg.clientKey)
  url.searchParams.set('scope', TIKTOK_SCOPES)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri(request))
  url.searchParams.set('state', state)
  /**
   * Always show the consent screen, never skip it for a live session.
   *
   * TikTok's default skips authorisation when the browser already has a valid
   * session — which would silently authorise whichever TikTok account happens
   * to be logged in. That is very likely a personal account rather than
   * @lighthousecare, and the mistake would be invisible until the report
   * filled up with the wrong videos. The extra click is the whole safeguard.
   */
  url.searchParams.set('disable_auto_auth', '1')

  const res = NextResponse.redirect(url)
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    // Lax, not Strict: the cookie has to survive TikTok redirecting the
    // browser back here, which Strict would refuse.
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
