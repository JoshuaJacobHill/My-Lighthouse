import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'SESSION_TOKEN'

/**
 * Lightweight route protection middleware.
 * Only checks for cookie existence — full session validation
 * (including expiry and role checks) happens at the page/action level.
 *
 * The destination is carried as `?next=`, which is the parameter the sign-in
 * page actually reads. It used to send `callbackUrl`, which nothing read, so
 * every deep link into a protected page quietly dumped people on the dashboard
 * after they signed in — the private event they clicked, the campaign link
 * they followed, gone.
 */
function toLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  // Path AND query: a filtered list or a campaign link is not the same page
  // without its parameters.
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // The volunteer application is public — anyone can apply without an account
  // (signed-in supporters get the password step skipped instead).
  if (pathname.startsWith('/volunteer/apply')) {
    return NextResponse.next()
  }

  // Volunteer portal routes — must be authenticated
  // The (auth) route group doesn't add to the URL: (auth)/login → /login
  if (pathname.startsWith('/volunteer')) {
    if (!sessionToken) return toLogin(request)
    return NextResponse.next()
  }

  // Admin routes — must be authenticated (role enforced in page)
  if (pathname.startsWith('/admin')) {
    if (!sessionToken) return toLogin(request)
    return NextResponse.next()
  }

  // The supporter portal. Guarded here as well as in the layout, because the
  // layout can only redirect to a bare /login — it cannot see which page
  // inside it was asked for, and that is exactly what a campaign link needs
  // kept.
  if (pathname.startsWith('/dashboard')) {
    if (!sessionToken) return toLogin(request)
    return NextResponse.next()
  }

  // Kiosk route — must be authenticated (role enforced in page)
  if (pathname.startsWith('/kiosk') && !pathname.startsWith('/kiosk/login')) {
    if (!sessionToken) {
      return NextResponse.redirect(new URL('/kiosk/login', request.url))
    }
    return NextResponse.next()
  }

  // Auth routes and everything else — public
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, public assets
     * - api routes (handled by route handlers)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
}
