import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'SESSION_TOKEN'

/**
 * Lightweight route protection middleware.
 * Only checks for cookie existence — full session validation
 * (including expiry and role checks) happens at the page/action level.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // The volunteer application is public — anyone can apply without an account
  // (signed-in supporters get the password step skipped instead).
  if (pathname.startsWith('/volunteer/apply')) {
    return NextResponse.next()
  }

  // Volunteer portal routes — must be authenticated
  if (pathname.startsWith('/volunteer')) {
    if (!sessionToken) {
      // The (auth) route group doesn't add to the URL: (auth)/login → /login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Admin routes — must be authenticated (role enforced in page)
  if (pathname.startsWith('/admin')) {
    if (!sessionToken) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
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
