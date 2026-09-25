/**
 * Items a wish list cannot ask for.
 *
 * Not censorship, and not a judgement about the child. Every list is shopped
 * by somebody spending around $200 of their own money, and a request for a
 * PlayStation puts that shopper in an impossible position: buy something they
 * cannot afford, or hand back a list with a child's name on it. Catching it at
 * the point of entry means the family is asked again while there is still time,
 * rather than in December.
 *
 * Pure and Prisma-free so the form checking as somebody types and the action
 * saving it agree. The list is seeded here and extended from admin settings —
 * see `bannedTerms()` in `wishlist-limits.server.ts`.
 */

/**
 * The obvious ones, as a starting point.
 *
 * Deliberately specific rather than clever. "Console" would catch a console
 * table; "expensive" would catch nothing anybody types. These are the things
 * children actually write, in the forms they actually write them.
 */
export const DEFAULT_BANNED_TERMS = [
  // Consoles and handhelds
  'ps5', 'ps4', 'playstation', 'play station',
  'xbox', 'x box', 'series x', 'series s',
  'nintendo switch', 'switch 2', 'switch oled', 'nintendo',
  'steam deck',
  // Computers and tablets
  'gaming pc', 'gaming computer', 'gaming laptop', 'laptop', 'macbook',
  'ipad', 'tablet', 'surface pro',
  'imac', 'desktop pc',
  // Phones and watches
  'iphone', 'i phone', 'samsung galaxy', 'pixel phone', 'smartphone', 'mobile phone',
  'apple watch', 'smart watch', 'smartwatch',
  // Audio and cameras
  'airpods', 'air pods', 'beats headphones', 'sonos',
  'gopro', 'go pro', 'drone', 'dslr',
  // Big-ticket toys and transport
  'e-bike', 'ebike', 'electric bike', 'electric scooter', 'e-scooter',
  'quad bike', 'motorbike', 'dirt bike', 'jet ski', 'trampoline',
  'pool table', 'playstation portal',
  // Screens
  'tv', 'television', 'smart tv', 'monitor', 'oled',
  // Money and vouchers big enough to be a problem
  'cash', 'money', 'gift card', 'giftcard', 'visa card',
  // Live animals — a real request, and never something a shopper can bring
  'puppy', 'kitten', 'a dog', 'a cat', 'pony', 'horse',
] as const

/**
 * Does this text ask for something we cannot promise?
 *
 * Matches on **word boundaries**, not substrings. "tv" inside "Activity book"
 * is not a television, and a child whose list is rejected for asking for an
 * activity book learns only that the form is broken.
 *
 * Returns the term that matched so the message can name it — "we can't promise
 * a PlayStation" is something a parent can act on; "invalid entry" is not.
 */
export function bannedTermIn(text: string, terms: readonly string[]): string | null {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `
  for (const term of terms) {
    const needle = term.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!needle) continue
    if (haystack.includes(` ${needle} `)) return term
  }
  return null
}

/**
 * What to say when it matches.
 *
 * Addressed to the child, because on their own form they are the one reading
 * it. Nobody is in trouble, and the sentence says so before it says no — the
 * point is to get a list we can actually fulfil, not to make a child feel
 * they asked for too much.
 */
export function bannedMessage(term: string): string {
  return `Sorry — we can’t promise a ${term} this Christmas. Could you pick something else you’d love?`
}

/** Tidy an admin-entered list into terms. One per line or comma-separated. */
export function parseTerms(raw: string): string[] {
  const seen = new Map<string, string>()
  for (const part of raw.split(/[\n,]/)) {
    const term = part.trim().replace(/\s+/g, ' ')
    if (!term) continue
    const key = term.toLowerCase()
    if (!seen.has(key)) seen.set(key, key)
  }
  return [...seen.values()]
}
