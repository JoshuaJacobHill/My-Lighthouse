/**
 * The banned-item list, as it actually stands.
 *
 * Defaults in code, additions in `AppSetting` so somebody can add "Labubu" in
 * November without a deploy. Read here rather than in the pure module because
 * the form, the action and the admin screen all need the same answer and only
 * one of them can touch the database.
 */
import { cache } from 'react'
import prisma from '@/lib/prisma'
import { DEFAULT_BANNED_TERMS, parseTerms } from '@/lib/wishlist-limits'

export const BANNED_TERMS_KEY = 'slh.bannedWishlistTerms'

/**
 * Every term, defaults included.
 *
 * Cached per request: a nomination form with three children checks four
 * fields each, and that should not be twelve queries.
 *
 * The stored list **replaces** nothing — it adds. Somebody editing the admin
 * field cannot accidentally un-ban a PlayStation by clearing the box, which is
 * the kind of quiet failure nobody notices until a shopper is holding a list
 * asking for one.
 */
export const bannedTerms = cache(async (): Promise<string[]> => {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: BANNED_TERMS_KEY },
      select: { value: true },
    })
    const extra = row ? parseTerms(row.value) : []
    return [...new Set([...DEFAULT_BANNED_TERMS, ...extra])]
  } catch (err) {
    console.error('bannedTerms failed', err)
    // The defaults still protect the common cases. A database hiccup should
    // not quietly open the gate to every console on the market.
    return [...DEFAULT_BANNED_TERMS]
  }
})

/** Just the added ones, for the admin screen to show and edit. */
export async function extraBannedTerms(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({
    where: { key: BANNED_TERMS_KEY },
    select: { value: true },
  })
  return row ? parseTerms(row.value) : []
}
