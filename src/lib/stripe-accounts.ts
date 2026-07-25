import Stripe from 'stripe'

/**
 * The Stripe accounts a fund's gifts can deposit to. Each maps to its own set
 * of env-var keys (kept in Vercel's encrypted settings, never in the database).
 * Add a new account by adding an entry here + its env vars — the admin dropdown
 * and routing pick it up automatically.
 */
export const STRIPE_ACCOUNTS = {
  CARE: {
    label: 'Lighthouse Care',
    secretKeyEnv: 'STRIPE_CARE_SECRET_KEY',
    webhookSecretEnv: 'STRIPE_CARE_WEBHOOK_SECRET',
  },
  CHURCH: {
    label: 'Lighthouse Church',
    secretKeyEnv: 'STRIPE_CHURCH_SECRET_KEY',
    webhookSecretEnv: 'STRIPE_CHURCH_WEBHOOK_SECRET',
  },
} as const

export type StripeAccountKey = keyof typeof STRIPE_ACCOUNTS

const DEFAULT_ACCOUNT: StripeAccountKey = 'CARE'

export function isAccountKey(value: string | null | undefined): value is StripeAccountKey {
  return !!value && value in STRIPE_ACCOUNTS
}

/** True when this account has its secret key configured in the environment. */
export function isAccountConfigured(key: StripeAccountKey): boolean {
  return Boolean(process.env[STRIPE_ACCOUNTS[key].secretKeyEnv])
}

/** The account list for the admin dropdown, flagged with whether keys are set. */
export function listStripeAccounts(): { key: StripeAccountKey; label: string; configured: boolean }[] {
  return (Object.keys(STRIPE_ACCOUNTS) as StripeAccountKey[]).map((key) => ({
    key,
    label: STRIPE_ACCOUNTS[key].label,
    configured: isAccountConfigured(key),
  }))
}

/**
 * Resolve a fund's stored deposit account to the account we can actually charge
 * on. Falls back to CARE when the chosen account has no keys yet, so a fund
 * never breaks — it just uses the main account until the other is configured.
 */
export function resolveAccount(stored: string | null | undefined): StripeAccountKey {
  const key = isAccountKey(stored) ? stored : DEFAULT_ACCOUNT
  return isAccountConfigured(key) ? key : DEFAULT_ACCOUNT
}

const clients = new Map<StripeAccountKey, Stripe>()

/** Lazily-built Stripe client for a specific account. */
export function getStripeFor(key: StripeAccountKey): Stripe {
  const cached = clients.get(key)
  if (cached) return cached
  const secret = process.env[STRIPE_ACCOUNTS[key].secretKeyEnv]
  if (!secret) {
    throw new Error(`${STRIPE_ACCOUNTS[key].secretKeyEnv} is not set for the ${STRIPE_ACCOUNTS[key].label} account.`)
  }
  const client = new Stripe(secret)
  clients.set(key, client)
  return client
}

/** Every configured webhook signing secret — the webhook tries each in turn. */
export function configuredWebhookSecrets(): { key: StripeAccountKey; secret: string }[] {
  return (Object.keys(STRIPE_ACCOUNTS) as StripeAccountKey[])
    .map((key) => ({ key, secret: process.env[STRIPE_ACCOUNTS[key].webhookSecretEnv] ?? '' }))
    .filter((a) => a.secret.length > 0)
}
