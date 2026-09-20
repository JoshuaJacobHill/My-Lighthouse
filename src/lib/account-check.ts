import prisma from '@/lib/prisma'

/**
 * The email check every sign-up path must run.
 *
 * Extracted from `signup.actions.ts`, which is where this was first written and
 * got right. It lives here so that the next sign-up flow — volunteers,
 * corporate partners, Santa's Little Helpers shoppers, whatever comes after —
 * calls it rather than reimplementing it slightly differently.
 *
 * The rule it enforces, and the reason for it:
 *
 *   **Proving control of an inbox is what unlocks data. Typing an address is
 *   not.**
 *
 * Somebody who gave $200 last year has a record here and no password. If a form
 * let anyone who typed that address set a password on it, their giving history
 * — name, amounts, dates — would belong to whoever guessed the email. So a
 * known address never gets an on-screen path forward; it gets an emailed link.
 *
 * Two functions, and both are needed:
 *
 *   `lookupEmail`     what to do with an address somebody typed
 *   `assertEmailFree` the check at the moment of creating the account
 *
 * The second is not redundant. A server action is directly callable, so
 * reaching the create step proves nothing about whether the first step ran.
 */

/** What we found, and therefore what the form should do next. */
export type EmailLookup =
  /**
   * A live account. Send them to sign in, and say so on screen — emailing a
   * link here leaves somebody waiting for something they do not need.
   */
  | { kind: 'account'; userId: string; name: string | null }
  /**
   * A record with no password: past giving, a row we created for them, or a
   * half-finished sign-up. **Email a setup link and say nothing else on
   * screen.** Confirming on screen that the address is known is what would let
   * somebody probe for donors.
   */
  | { kind: 'history'; userId: string | null; name: string | null }
  /** Nothing on file. Let them sign up on the spot. */
  | { kind: 'new' }

/**
 * What to do with an email address somebody has typed into a form.
 *
 * Case-insensitive on purpose: `mode: 'insensitive'` is what stops
 * "Josh@..." creating a second account alongside "josh@...".
 */
export async function lookupEmail(rawEmail: string): Promise<EmailLookup> {
  const email = rawEmail.trim().toLowerCase()
  if (!email) return { kind: 'new' }

  const [user, giftCount] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, name: true, passwordHash: true, isActive: true },
    }),
    prisma.donation.count({ where: { donorEmail: { equals: email, mode: 'insensitive' } } }),
  ])

  if (user?.passwordHash && user.isActive) {
    return { kind: 'account', userId: user.id, name: user.name }
  }
  if (user || giftCount > 0) {
    return { kind: 'history', userId: user?.id ?? null, name: user?.name ?? null }
  }
  return { kind: 'new' }
}

/** What a form should tell somebody whose email already has an account. */
export const ALREADY_HAVE_ACCOUNT =
  'This email has already been used. Please sign in, or reset your password.'

/**
 * Refuse to create an account on an email that already has any record.
 *
 * Call this inside the action that writes the user, immediately before the
 * write, every time — not instead of `lookupEmail`, as well as it.
 *
 * Refuses whether or not a password is set. A passwordless row is the case that
 * matters: it is somebody's giving history, and it must only ever be claimed
 * through a link sent to that inbox.
 *
 * Returns an error string to hand straight back to the form, or null when the
 * address is genuinely free.
 */
export async function assertEmailFree(rawEmail: string): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase()
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })
  return existing ? ALREADY_HAVE_ACCOUNT : null
}
