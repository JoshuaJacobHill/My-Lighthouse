// Event sponsor tiers + amount ranges (AUD). Plain module so it can be imported
// by both server actions and client components.
export const SPONSOR_TIERS = {
  BRONZE: { min: 2500, max: 5000, label: 'Bronze' },
  SILVER: { min: 5000, max: 10000, label: 'Silver' },
  GOLD: { min: 10000, max: 100000, label: 'Gold' },
} as const

export type SponsorTierKey = keyof typeof SPONSOR_TIERS

/** Normalise a user-entered website to an absolute URL (adds https:// if missing). */
export function normaliseWebsiteUrl(raw?: string | null): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}
