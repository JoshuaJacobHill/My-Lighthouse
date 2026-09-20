/**
 * Where a sign-in may send somebody afterwards.
 *
 * A `?next=` parameter that is used without checking is an open redirect: a
 * link to our own login page that lands the person on somebody else's site,
 * after they have just typed a password. It looks like our domain in the
 * address bar right up to the moment it isn't.
 *
 * So only a path within this app is allowed, and the rules are deliberately
 * blunt rather than clever:
 *
 *   must start with a single "/"      — no absolute URLs, no scheme
 *   must not start with "//"          — that is protocol-relative, i.e. offsite
 *   must not contain "\" or a newline — both get normalised in ways that vary
 *                                       between what we check and what the
 *                                       browser follows
 *
 * Anything else falls back to null, and the caller sends them wherever it
 * would have sent them anyway.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v.startsWith('/')) return null
  if (v.startsWith('//')) return null
  if (v.includes('\\') || /[\r\n\t]/.test(v)) return null
  // A path, a query and a fragment only — nothing that could carry a host.
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/.test(v)) return null
  return v
}
