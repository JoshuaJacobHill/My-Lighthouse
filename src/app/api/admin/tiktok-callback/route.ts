import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasCapability } from '@/lib/permissions'
import { exchangeAuthorizationCode, tiktokConfig } from '@/lib/integrations/tiktok'
import { redirectUri, STATE_COOKIE } from '../tiktok-connect/route'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/tiktok-callback ──────────────────────────────────────────
//
// Where TikTok sends the browser after approval. Turns the one-time code into
// a refresh token and stores it.
//
// This is the only moment a TikTok refresh token is created; everything after
// rotates the stored one. So the response says plainly whether it was saved —
// a silent success here would be discovered a day later as an authentication
// failure with no obvious cause.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || !(await hasCapability('business.reports'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams
  const denied = q.get('error')
  if (denied) {
    return NextResponse.json(
      { ok: false, error: `TikTok declined: ${denied}`, description: q.get('error_description') },
      { status: 400 },
    )
  }

  const code = q.get('code')
  const state = q.get('state')
  const expected = request.cookies.get(STATE_COOKIE)?.value

  if (!code) return NextResponse.json({ ok: false, error: 'No code returned.' }, { status: 400 })
  if (!expected || !state || state !== expected) {
    // Either the authorisation did not start here, or it took longer than the
    // ten minutes the cookie lives. Both mean start again rather than proceed.
    return NextResponse.json(
      { ok: false, error: 'State did not match. Start again at /api/admin/tiktok-connect.' },
      { status: 400 },
    )
  }

  const cfg = tiktokConfig()
  if (!cfg) {
    return NextResponse.json({ ok: false, error: 'TikTok is not configured.' }, { status: 400 })
  }

  try {
    const result = await exchangeAuthorizationCode(cfg, code, redirectUri(request))

    /**
     * What TikTok says was granted, from both places it says it.
     *
     * Scopes are individually deniable — "the user can deny access to one
     * scope while granting access to others" — so a run can succeed having
     * been refused `video.list`, which then looks exactly like an account
     * with no videos. Reported plainly, and checked, rather than assumed.
     */
    const grantedOnRedirect = q.get('scopes')
    const granted = (result.scope ?? grantedOnRedirect ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const missing = ['user.info.basic', 'video.list'].filter(
      (needed) => granted.length > 0 && !granted.includes(needed),
    )

    const res = NextResponse.json({
      ok: true,
      refreshTokenSaved: result.refreshTokenSaved,
      scopesGranted: granted.length > 0 ? granted : 'not reported',
      scopesMissing: missing.length > 0 ? missing : 'none',
      ...(missing.includes('video.list')
        ? {
            warning:
              'video.list was not granted, so no videos can be read. Authorise again and leave every permission switched on.',
          }
        : {}),
      accessTokenValidForSeconds: result.expiresIn,
      next: 'Probe it at /api/admin/tiktok-probe before trusting any figure',
    })
    // Single use: a state left lying about is a state that can be replayed.
    res.cookies.delete(STATE_COOKIE)
    return res
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 },
    )
  }
}
