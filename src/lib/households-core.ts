/**
 * Households: the vocabulary, and the small decisions that go with it.
 *
 * Pure and Prisma-free so the forms, the filters and the actions all agree.
 * What lives here is deliberately more than a list of labels — how a household
 * is described, when a duplicate is worth flagging, and what "recently" means
 * for a trolley are all decisions somebody will otherwise make twice,
 * differently.
 */

export const SUPPORT_KINDS = [
  ['FREE_TROLLEY', 'Free trolley', 'A full trolley of essentials, given'],
  ['FOOD_HAMPER', 'Food hamper', 'A hamper of groceries'],
  ['CHRISTMAS_HAMPER', 'Christmas hamper', 'The Christmas food hamper'],
  ['SANTAS_LITTLE_HELPERS', 'Santa’s Little Helpers', 'Christmas gifts for the children'],
  ['EMERGENCY_RELIEF', 'Emergency relief', 'Help at short notice — fuel, a bill, a night'],
  ['DISASTER_RELIEF', 'Disaster relief', 'Flood, fire or storm response'],
  ['SCHOOL_SUPPLIES', 'School supplies', 'Books, uniforms, a backpack'],
  ['OTHER', 'Something else', 'Anything the list above does not cover'],
] as const

export type SupportKind = (typeof SUPPORT_KINDS)[number][0]

export function supportLabel(kind: string): string {
  return SUPPORT_KINDS.find(([k]) => k === kind)?.[1] ?? 'Support'
}

export const RELATIONSHIPS = [
  ['GUARDIAN', 'Parent or guardian'],
  ['ADULT', 'Adult'],
  ['CHILD', 'Child'],
  ['OTHER', 'Other'],
] as const

export const NOTE_CATEGORIES = [
  ['GENERAL', 'General'],
  ['VISIT', 'Visit'],
  ['PHONE_CALL', 'Phone call'],
  ['ASSESSMENT', 'Assessment'],
  ['SAFEGUARDING', 'Safeguarding'],
] as const

export const HOUSEHOLD_STATUSES = [
  ['ACTIVE', 'Active', 'Being supported now'],
  ['INACTIVE', 'Inactive', 'Known to us, nothing open'],
  ['CLOSED', 'Closed', 'Closed on review or at their request'],
] as const

export const REFERRAL_STATUSES = [
  ['OPEN', 'Open'],
  ['ACCEPTED', 'Accepted'],
  ['DECLINED', 'Declined'],
  ['CLOSED', 'Closed'],
] as const

export function oneOfOrNull<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  const value = String(raw ?? '').trim()
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/**
 * Normalise a phone number for comparison only.
 *
 * Australian mobiles get written half a dozen ways — 0412 884 221,
 * +61412884221, (04) 1288 4221 — and a duplicate check that misses those is a
 * duplicate check that does nothing. Digits only, with a leading 61 folded
 * back to 0, so the same phone matches itself. **Never store this**: what
 * somebody typed is what should be shown back to them.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  const local = digits.startsWith('61') ? `0${digits.slice(2)}` : digits
  return local.length >= 9 ? local.slice(-9) : local
}

export function emailKey(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim().toLowerCase()
  return value.includes('@') ? value : null
}

/**
 * How a household reads in a list.
 *
 * Name first, then the suburb — because "Leila M." means nothing across four
 * hundred records and "Leila M. · Beenleigh" usually means exactly one person
 * to the staff member reading it.
 */
export function describeHousehold(input: {
  name: string
  suburb?: string | null
  members?: { relationship: string }[]
}): string {
  const children = input.members?.filter((m) => m.relationship === 'CHILD').length ?? 0
  const parts = [
    input.suburb?.trim() || null,
    children > 0 ? `${children} ${children === 1 ? 'child' : 'children'}` : null,
  ].filter(Boolean)
  return parts.length ? `${input.name} · ${parts.join(' · ')}` : input.name
}

/**
 * Days since a household last received a given kind of support.
 *
 * The fairness question, and the one worth making easy to answer: somebody at
 * a desk deciding whether to give a second trolley this fortnight should not
 * have to read a date and do arithmetic. Null when they have never had one.
 */
export function daysSince(last: Date | null | undefined, now: Date = new Date()): number | null {
  if (!last) return null
  const DAY = 24 * 60 * 60 * 1000
  // Floored to Brisbane days so "yesterday" is always 1, whatever the hour.
  const day = (d: Date) => Math.floor((d.getTime() + 10 * 60 * 60 * 1000) / DAY)
  return Math.max(0, day(now) - day(last))
}

/**
 * Is this recent enough to mention when somebody asks for more?
 *
 * Not a rule about what to give — that is a judgement for a person who can see
 * the family. It is a prompt, so the judgement is made with the fact in hand
 * rather than after the trolley has gone out.
 */
export function recentlyGiven(days: number | null, within = 30): boolean {
  return days !== null && days <= within
}
