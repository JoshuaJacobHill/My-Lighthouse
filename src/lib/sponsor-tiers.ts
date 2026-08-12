// Event sponsor tiers + amount ranges (AUD). Plain module so it can be imported
// by both server actions and client components.
export const SPONSOR_TIERS = {
  BRONZE: { min: 2500, max: 5000, label: 'Bronze' },
  SILVER: { min: 5000, max: 10000, label: 'Silver' },
  GOLD: { min: 10000, max: 100000, label: 'Gold' },
} as const

export type SponsorTierKey = keyof typeof SPONSOR_TIERS

// All sponsor tiers (paid + category), in the order they display on the event
// page. FOOD_ACTIVITY is a non-paid category assigned by admins, so it isn't in
// the public "Become a sponsor" tier picker (SPONSOR_TIERS) above.
export const SPONSOR_TIER_ORDER = ['GOLD', 'SILVER', 'BRONZE', 'FOOD_ACTIVITY'] as const
export type AnySponsorTier = (typeof SPONSOR_TIER_ORDER)[number]

export const SPONSOR_TIER_LABEL: Record<AnySponsorTier, string> = {
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  FOOD_ACTIVITY: 'Food/Activity',
}

export const SPONSOR_TIER_HEADING: Record<AnySponsorTier, string> = {
  GOLD: 'Gold sponsors',
  SILVER: 'Silver sponsors',
  BRONZE: 'Bronze sponsors',
  FOOD_ACTIVITY: 'Food & activity sponsors',
}

/** Normalise a user-entered website to an absolute URL (adds https:// if missing). */
export function normaliseWebsiteUrl(raw?: string | null): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}
