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
     * Back to the page, not to a wall of JSON.
     *
     * TikTok's own review asks for a demo video that "clearly shows the user
     * interface and user interactions", and a redirect that ends on raw JSON
     * is neither. It is also simply worse for whoever runs this: the page can
     * say what was granted and show the videos it read.
     */
    const back = new URL('/dashboard/business/tiktok', request.nextUrl.origin)
    back.searchParams.set('connected', '1')
    const grantedOnRedirect = q.get('scopes')
    if (result.scope || grantedOnRedirect) {
      back.searchParams.set('scopes', result.scope ?? grantedOnRedirect ?? '')
    }

    const res = NextResponse.redirect(back)
    // Single use: a state left lying about is a state that can be replayed.
    res.cookies.delete(STATE_COOKIE)
    return res
  } catch (err) {
    const back = new URL('/dashboard/business/tiktok', request.nextUrl.origin)
    back.searchParams.set('error', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.redirect(back)
  }
}
