import prisma from '@/lib/prisma'

/**
 * Extra verified email addresses on an account.
 *
 * Why this exists: someone signs up with their work address, then gives with a
 * personal one, and their giving history ends up split in two. Linking a second
 * address pulls it back together.
 *
 * The rule that makes it safe: an address counts for nothing until it has been
 * verified from the inbox itself. Every read below filters on `verifiedAt`.
 */

/** Every address this account owns — primary first, then verified extras. */
export async function getVerifiedEmails(userId: string): Promise<string[]> {
  const [user, extras] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } }),
    prisma.userEmail.findMany({
      where: { userId, verifiedAt: { not: null } },
      select: { email: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const out: string[] = []
  // The primary counts only when it's verified, matching claimDonationsForUser.
  if (user?.email && user.emailVerified) out.push(user.email.toLowerCase())
  for (const e of extras) if (!out.includes(e.email)) out.push(e.email)
  return out
}

export type AddEmailCheck =
  | { ok: true; unclaimedUserId: string | null }
  | { ok: false; reason: string }

/**
 * Can this account add this address?
 *
 * The important refusal is the middle one. If the address is the primary of an
 * account that someone has actually claimed — it has a password — then linking
 * it here would be a way to absorb another person's account and their giving
 * history. That case is always refused, even after verification, and has to go
 * through a human.
 *
 * An address sitting on a passwordless donor record is a different matter:
 * nobody has ever signed in as it, and it's exactly the case this feature is
 * for. It's allowed, but the merge only happens once the address is verified.
 */
export async function canAddEmail(userId: string, email: string): Promise<AddEmailCheck> {
  const normalised = email.trim().toLowerCase()

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (me?.email?.toLowerCase() === normalised) {
    return { ok: false, reason: 'That’s already the main email on your account.' }
  }

  const existingLink = await prisma.userEmail.findUnique({
    where: { email: normalised },
    select: { userId: true, verifiedAt: true },
  })
  if (existingLink) {
    if (existingLink.userId === userId) {
      return {
        ok: false,
        reason: existingLink.verifiedAt
          ? 'You’ve already added that address.'
          : 'That address is already waiting to be confirmed — check your inbox.',
      }
    }
    // Deliberately vague: don't confirm whose account it is.
    return { ok: false, reason: 'That address can’t be added. Please contact us if you think it should be.' }
  }

  const otherAccount = await prisma.user.findFirst({
    where: { email: { equals: normalised, mode: 'insensitive' } },
    select: { id: true, passwordHash: true, volunteerProfile: { select: { id: true } } },
  })
  if (otherAccount) {
    if (otherAccount.passwordHash || otherAccount.volunteerProfile) {
      return {
        ok: false,
        reason:
          'That address already has its own Lighthouse account. Sign in with it instead, or email us and we’ll join the two together.',
      }
    }
    return { ok: true, unclaimedUserId: otherAccount.id }
  }

  return { ok: true, unclaimedUserId: null }
}

/**
 * Once an address is verified, bring across the giving that belongs to it:
 * unclaimed gifts recorded against the address, plus anything sitting on a
 * passwordless donor record for it. That stale record is deactivated rather
 * than deleted — an automated merge should never destroy data, and an admin can
 * tidy it up knowing what happened.
 */
export async function absorbGivingForEmail(userId: string, email: string): Promise<number> {
  const normalised = email.trim().toLowerCase()
  let moved = 0

  const claimed = await prisma.donation.updateMany({
    where: { userId: null, donorEmail: { equals: normalised, mode: 'insensitive' } },
    data: { userId },
  })
  moved += claimed.count

  const stale = await prisma.user.findFirst({
    where: { email: { equals: normalised, mode: 'insensitive' } },
    select: { id: true, passwordHash: true, volunteerProfile: { select: { id: true } } },
  })
  if (stale && stale.id !== userId && !stale.passwordHash && !stale.volunteerProfile) {
    const transferred = await prisma.donation.updateMany({ where: { userId: stale.id }, data: { userId } })
    moved += transferred.count
    // Deactivated, not deleted, and the name is left alone — an automated
    // merge shouldn't destroy anything, and an admin needs to be able to see
    // what this record was when they tidy up.
    await prisma.user.update({ where: { id: stale.id }, data: { isActive: false } })
    console.info(`[user-emails] merged donor record ${stale.id} into ${userId} via ${normalised}`)
  }

  // Anyone who has tithed sees church-only content.
  if (moved > 0) {
    const tithe = await prisma.donation.findFirst({ where: { userId, isTithe: true }, select: { id: true } })
    if (tithe) await prisma.user.update({ where: { id: userId }, data: { isChurchMember: true } })
  }
  return moved
}
