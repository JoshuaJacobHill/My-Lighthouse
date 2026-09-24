/**
 * The questions a wish list asks.
 *
 * Pure and Prisma-free, so the form that collects them and the action that
 * saves them check against one list. Straight from the mockup, which is where
 * the wording was argued out.
 */

/**
 * Interests are chips, not a text box.
 *
 * A nine-year-old taps six of these and writes nothing; the shopper still
 * learns more than an empty field would have told them. Specific brands sit
 * beside broad categories on purpose — "Spider-Man" buys a better present than
 * "superheroes" — and anything missing can be typed in, because this list will
 * never keep up with what children are actually into.
 */
export const INTERESTS = [
  'Sport', 'Footy', 'Netball', 'Swimming', 'BMX', 'Skating',
  'Gaming', 'Minecraft', 'Roblox', 'LEGO',
  'Arts & crafts', 'Drawing', 'Slime', 'Music', 'Dancing',
  'Spider-Man', 'Barbie', 'Bluey', 'Pokémon', 'Marvel',
  'Animals', 'Horses', 'Dinosaurs', 'Space',
  'Reading', 'Cooking', 'Fishing', 'Camping',
] as const

/**
 * Size bands.
 *
 * "Size 4" is not an answer — a size 4 toddler and a size 4 youth shoe are
 * different children, and a shopper standing in Kmart cannot tell which was
 * meant. The band carries that, and the number is whatever the family writes.
 */
export const SIZE_BANDS = [
  ['infant', 'Infant', '0–12 months'],
  ['toddler', 'Toddler', '1–4 years'],
  ['kids', 'Kids', '4–10 years'],
  ['youth', 'Youth', '10–14 years'],
  ['adult', 'Adult', '14+ / mens & womens'],
] as const

export type SizeBand = (typeof SIZE_BANDS)[number][0]

export const WISH_KINDS = [
  ['want', 'Something they want', 'The one thing they would pick themselves.'],
  ['need', 'Something they need', 'Everyday things — a school bag, a drink bottle.'],
  ['wear', 'Something to wear', 'Clothes, shoes, anything they can put on.'],
  ['read', 'Something to read', 'A book, a comic, a magazine.'],
] as const

export type WishKind = (typeof WISH_KINDS)[number][0]

export function cleanBand(raw: unknown): SizeBand | null {
  const v = String(raw ?? '').trim()
  return (SIZE_BANDS.find(([value]) => value === v)?.[0] as SizeBand) ?? null
}

export function bandLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return SIZE_BANDS.find(([v]) => v === value)?.[1] ?? null
}

/**
 * A size as a shopper reads it: "Kids · Size 7", or just one half when that is
 * all anybody filled in. Null when neither was answered, so the page can leave
 * the chip out rather than print an empty label.
 */
export function sizeLabel(band: string | null | undefined, size: string | null | undefined): string | null {
  const b = bandLabel(band)
  const s = size?.trim() || null
  if (b && s) return `${b} · ${s}`
  return b ?? s
}

/**
 * Tidy a list of interests.
 *
 * Trims, drops blanks, removes duplicates case-insensitively — "Lego" typed in
 * by a parent should not sit next to the "LEGO" chip — and caps the length so
 * a free-text box cannot turn into an essay. The preset chips win the casing
 * contest, because they are the ones a shopper is used to reading.
 */
export function cleanInterests(raw: unknown, limit = 20): string[] {
  const list = Array.isArray(raw) ? raw : []
  const preset = new Map(INTERESTS.map((i) => [i.toLowerCase(), i as string]))
  const seen = new Map<string, string>()

  for (const entry of list) {
    const text = String(entry ?? '').trim().slice(0, 40)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.set(key, preset.get(key) ?? text)
    if (seen.size >= limit) break
  }
  return [...seen.values()]
}

/**
 * Has somebody filled this list in?
 *
 * All four gifts. That is what the organisation chases a family about, and
 * what decides whether a list is ready to hand to a shopper — interests and a
 * story make it better but a shopper can work without them.
 */
export function wishListReady(child: {
  wishWant?: string | null
  wishNeed?: string | null
  wishWear?: string | null
  wishRead?: string | null
}): boolean {
  return Boolean(child.wishWant && child.wishNeed && child.wishWear && child.wishRead)
}
