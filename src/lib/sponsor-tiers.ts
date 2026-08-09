// Event sponsor tiers + amount ranges (AUD). Plain module so it can be imported
// by both server actions and client components.
export const SPONSOR_TIERS = {
  BRONZE: { min: 2500, max: 5000, label: 'Bronze' },
  SILVER: { min: 5000, max: 10000, label: 'Silver' },
  GOLD: { min: 10000, max: 100000, label: 'Gold' },
} as const

export type SponsorTierKey = keyof typeof SPONSOR_TIERS
