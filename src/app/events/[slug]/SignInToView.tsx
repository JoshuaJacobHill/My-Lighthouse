import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'

/**
 * What an anonymous visitor sees for a private event.
 *
 * A page rather than a redirect, because a bounce to a login form gives no
 * explanation and a 404 is a lie. This says what the thing is, why they cannot
 * see it, and the two ways forward.
 *
 * The title is shown; nothing else is. It was in the link they followed, so it
 * is not a secret, and naming it is what makes the page read as "you are in the
 * right place, just signed out" instead of "something went wrong".
 */
export function SignInToView({ title, slug }: { title: string; slug: string }) {
  const next = encodeURIComponent(`/events/${slug}`)

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-16 sm:px-8">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-orange-100 text-orange-600">
        <Lock className="h-6 w-6" aria-hidden="true" />
      </span>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 leading-relaxed text-neutral-600">
        This one is just for our community. Please sign in, or create an account, to see the details
        and book.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/login?next=${next}`}
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={`/signup?next=${next}`}
          className="inline-flex items-center rounded-full border border-neutral-300 px-7 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
        >
          Create an account
        </Link>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-neutral-500">
        An account is free, takes a minute, and is the same one you would use to give, volunteer or
        manage your tickets.
      </p>
    </div>
  )
}
